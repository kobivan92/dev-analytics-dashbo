#!/usr/bin/env python
# coding: utf-8

# In[3]:


# Bitbucket Server / Data Center developer KPI (weekly) from commits + lines added/removed
# Run this as ONE Jupyter cell. No pip installs. Uses stdlib (+ pandas/matplotlib if available).

import base64, json, math, os, re, sys, time
from datetime import datetime, timedelta, timezone
from getpass import getpass
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed

# -----------------------------
# CONFIG (edit these)
# -----------------------------
BASE_URL = "http://172.31.200.215:8080"  # Bitbucket base (no trailing slash needed)
DAYS_BACK = 90                           # how far back to look
TOP_N_DEVS = 10                          # show top N developers in charts
MAX_REPOS = None                         # e.g. 50 to limit; None = all discovered repos
MAX_COMMITS_PER_REPO = None              # e.g. 2000; None = no hard cap (will still stop at cutoff date)
MAX_WORKERS = 12                         # threads for fetching per-commit change stats
REQUEST_TIMEOUT_SEC = 60
SLEEP_BETWEEN_REQUESTS_SEC = 0.0         # set e.g. 0.05 if your server throttles
VERIFY_SSL = True                        # only relevant if you change to https in an environment that validates certs

# -----------------------------
# Auth (avoid hardcoding password)
# -----------------------------
USER = "ivan.kobyakov"
PASSWORD = "9Uo2lMW1HrV2"
if not PASSWORD:
    PASSWORD = getpass("Bitbucket password (won't echo): ")

# -----------------------------
# Optional deps (nice-to-have)
# -----------------------------
try:
    import pandas as pd
except Exception:
    pd = None

try:
    import matplotlib.pyplot as plt
except Exception:
    plt = None

# -----------------------------
# HTTP helpers (stdlib only)
# -----------------------------
def _basic_auth_header(user, pw):
    token = base64.b64encode(f"{user}:{pw}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"

AUTH_HEADER = _basic_auth_header(USER, PASSWORD)

def bb_get_json(path, params=None):
    """
    GET JSON from Bitbucket.
    path: '/rest/api/1.0/...'
    params: dict
    """
    if not path.startswith("/"):
        path = "/" + path
    url = BASE_URL.rstrip("/") + path
    if params:
        url += ("?" + urlencode(params, doseq=True))
    req = Request(url, headers={"Authorization": AUTH_HEADER, "Accept": "application/json"})
    if SLEEP_BETWEEN_REQUESTS_SEC:
        time.sleep(SLEEP_BETWEEN_REQUESTS_SEC)
    with urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw)

def bb_paginate(path, params=None, limit=100):
    """
    Bitbucket Server pagination: values + isLastPage + nextPageStart.
    Yields items from 'values'.
    """
    start = 0
    params = dict(params or {})
    params.setdefault("limit", limit)
    while True:
        params["start"] = start
        data = bb_get_json(path, params=params)
        for v in data.get("values", []):
            yield v
        if data.get("isLastPage", True):
            break
        start = data.get("nextPageStart")
        if start is None:
            break

# -----------------------------
# Repo discovery
# -----------------------------
def discover_repos():
    """
    Returns list of dicts: {projectKey, repoSlug, repoName}
    Tries global /repos then falls back to /projects -> /repos.
    """
    repos = []
    # Try global repos endpoint
    try:
        for r in bb_paginate("/rest/api/1.0/repos", params={"limit": 100}, limit=100):
            project = (r.get("project") or {}).get("key")
            slug = r.get("slug")
            name = r.get("name") or slug
            if project and slug:
                repos.append({"projectKey": project, "repoSlug": slug, "repoName": name})
        if repos:
            return repos
    except Exception:
        pass

    # Fallback: enumerate projects then repos
    for p in bb_paginate("/rest/api/1.0/projects", params={"limit": 100}, limit=100):
        key = p.get("key")
        if not key:
            continue
        for r in bb_paginate(f"/rest/api/1.0/projects/{key}/repos", params={"limit": 100}, limit=100):
            slug = r.get("slug")
            name = r.get("name") or slug
            if key and slug:
                repos.append({"projectKey": key, "repoSlug": slug, "repoName": name})
    return repos

# -----------------------------
# Commit + change stats
# -----------------------------
def week_start_date(dt):
    # Week starts Monday (ISO week): normalize to date at 00:00
    # dt is timezone-aware
    d = dt.date()
    # Monday=0 ... Sunday=6
    monday = d - timedelta(days=d.weekday())
    return datetime(monday.year, monday.month, monday.day, tzinfo=dt.tzinfo)

def extract_author(c):
    a = c.get("author") or {}
    user = a.get("name") or a.get("displayName")
    email = a.get("emailAddress")
    if not user:
        # Sometimes nested user in 'author' object
        u = a.get("user") or {}
        user = u.get("name") or u.get("displayName")
        email = email or u.get("emailAddress")
    user = user or "unknown"
    return user, (email or "")

def iter_recent_commits(projectKey, repoSlug, cutoff_ts_ms):
    """
    Yields commit dicts (Bitbucket format) newer than cutoff.
    Stops early once older commits encountered.
    """
    seen = 0
    for c in bb_paginate(f"/rest/api/1.0/projects/{projectKey}/repos/{repoSlug}/commits",
                         params={"limit": 100}, limit=100):
        seen += 1
        ts = c.get("authorTimestamp") or c.get("committerTimestamp") or 0
        if ts < cutoff_ts_ms:
            break
        yield c
        if MAX_COMMITS_PER_REPO and seen >= MAX_COMMITS_PER_REPO:
            break

def get_commit_change_totals(projectKey, repoSlug, commit_id):
    """
    Sum linesAdded/linesRemoved across changed files for the commit.
    Works best if server supports 'withCounts=true'. If not, returns 0/0.
    """
    added = removed = files = 0
    # Try withCounts=true first
    paths_to_try = [
        (f"/rest/api/1.0/projects/{projectKey}/repos/{repoSlug}/commits/{commit_id}/changes",
         {"limit": 1000, "withCounts": "true"}),
        (f"/rest/api/1.0/projects/{projectKey}/repos/{repoSlug}/commits/{commit_id}/changes",
         {"limit": 1000}),
    ]
    last_err = None
    for path, params in paths_to_try:
        try:
            for ch in bb_paginate(path, params=params, limit=500):
                files += 1
                # common keys when withCounts is enabled:
                # linesAdded / linesRemoved (sometimes linesDeleted)
                a = ch.get("linesAdded")
                r = ch.get("linesRemoved")
                if a is None and "linesInserted" in ch:  # some variants
                    a = ch.get("linesInserted")
                if r is None and "linesDeleted" in ch:
                    r = ch.get("linesDeleted")
                added += int(a or 0)
                removed += int(r or 0)
            return added, removed, files
        except Exception as e:
            last_err = e
            continue
    # If both attempts fail, degrade gracefully
    return 0, 0, 0

# -----------------------------
# Main: collect rows
# -----------------------------
cutoff_dt = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
cutoff_ts_ms = int(cutoff_dt.timestamp() * 1000)

repos = discover_repos()
if MAX_REPOS:
    repos = repos[:MAX_REPOS]

print(f"Discovered {len(repos)} repos. Collecting commits since {cutoff_dt.date()} (UTC)…")

rows = []
change_tasks = []

# 1) Pull commits (cheap), build pending tasks for change stats (expensive)
for i, repo in enumerate(repos, 1):
    pk, slug, rname = repo["projectKey"], repo["repoSlug"], repo["repoName"]
    try:
        commits = list(iter_recent_commits(pk, slug, cutoff_ts_ms))
    except Exception as e:
        print(f"[WARN] Failed listing commits for {pk}/{slug}: {e}")
        continue

    for c in commits:
        cid = c.get("id")
        ts = c.get("authorTimestamp") or c.get("committerTimestamp") or 0
        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        wk = week_start_date(dt)
        author, email = extract_author(c)
        rows.append({
            "project": pk,
            "repo": slug,
            "repo_name": rname,
            "commit": cid,
            "author": author,
            "email": email,
            "datetime_utc": dt,
            "week_start_utc": wk,
            "lines_added": None,
            "lines_removed": None,
            "files_changed": None,
        })
        if cid:
            change_tasks.append((pk, slug, cid))

    if i % 10 == 0:
        print(f"  scanned {i}/{len(repos)} repos…")

print(f"Found {len(rows)} commits in range; fetching per-commit change stats (lines/files)…")

# 2) Fetch change stats in parallel
# Map commit id -> (added, removed, files)
change_map = {}

def _fetch_one(task):
    pk, slug, cid = task
    a, r, f = get_commit_change_totals(pk, slug, cid)
    return cid, a, r, f

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
    futures = [ex.submit(_fetch_one, t) for t in change_tasks]
    done = 0
    for fut in as_completed(futures):
        cid, a, r, f = fut.result()
        change_map[cid] = (a, r, f)
        done += 1
        if done % 250 == 0:
            print(f"  change stats: {done}/{len(futures)} commits…")

# 3) Merge change stats into rows
for row in rows:
    cid = row["commit"]
    a, r, f = change_map.get(cid, (0, 0, 0))
    row["lines_added"] = a
    row["lines_removed"] = r
    row["files_changed"] = f
    row["lines_net"] = a - r

# -----------------------------
# Analyze + visualize
# -----------------------------
if not rows:
    print("No commits found in the selected window.")
    raise SystemExit(0)

if pd is None:
    # Minimal fallback without pandas
    print("\nPandas not available; showing a simple text summary (installing not allowed).\n")
    # Aggregate (week, author)
    agg = {}
    for r in rows:
        key = (r["week_start_utc"].date().isoformat(), r["author"])
        a = agg.setdefault(key, {"commits": 0, "added": 0, "removed": 0, "net": 0, "files": 0})
        a["commits"] += 1
        a["added"] += r["lines_added"]
        a["removed"] += r["lines_removed"]
        a["net"] += r["lines_net"]
        a["files"] += r["files_changed"]
    # Print top authors by commits
    by_author = {}
    for (_, author), v in agg.items():
        by_author.setdefault(author, 0)
        by_author[author] += v["commits"]
    top = sorted(by_author.items(), key=lambda x: x[1], reverse=True)[:TOP_N_DEVS]
    print("Top devs by commits:")
    for a, c in top:
        print(f"  {a}: {c}")
else:
    df = pd.DataFrame(rows)
    # Clean
    df["author"] = df["author"].fillna("unknown")
    df["week_start_utc"] = pd.to_datetime(df["week_start_utc"], utc=True)

    # Weekly per-author KPIs
    weekly = (
        df.groupby(["week_start_utc", "author"], as_index=False)
          .agg(
              commits=("commit", "count"),
              lines_added=("lines_added", "sum"),
              lines_removed=("lines_removed", "sum"),
              lines_net=("lines_net", "sum"),
              files_changed=("files_changed", "sum"),
              repos_touched=("repo", pd.Series.nunique),
          )
          .sort_values(["week_start_utc", "commits"], ascending=[True, False])
    )

    # Pick top devs by commits (you can change to lines_added if you prefer)
    top_devs = (
        weekly.groupby("author")["commits"].sum()
              .sort_values(ascending=False)
              .head(TOP_N_DEVS)
              .index.tolist()
    )
    weekly_top = weekly[weekly["author"].isin(top_devs)].copy()

    display(df.head(10))
    print("\nWeekly KPI (top devs) sample:")
    display(weekly_top.head(20))

    # Export if you want
    out_csv = "dev_kpi_weekly.csv"
    weekly.to_csv(out_csv, index=False)
    print(f"\nSaved full weekly table to: {out_csv}")

    # Plot if matplotlib available
    if plt is None:
        print("\nMatplotlib not available; skipping charts.")
    else:
        # Pivot for plotting
        pivot_commits = weekly_top.pivot(index="week_start_utc", columns="author", values="commits").fillna(0).sort_index()
        pivot_added   = weekly_top.pivot(index="week_start_utc", columns="author", values="lines_added").fillna(0).sort_index()
        pivot_net     = weekly_top.pivot(index="week_start_utc", columns="author", values="lines_net").fillna(0).sort_index()

        plt.figure(figsize=(12, 5))
        for col in pivot_commits.columns:
            plt.plot(pivot_commits.index, pivot_commits[col], marker="o", linewidth=1, label=col)
        plt.title(f"Commits per week (top {len(top_devs)} devs)")
        plt.xlabel("Week (UTC, Monday start)")
        plt.ylabel("Commits")
        plt.grid(True, alpha=0.3)
        plt.legend(bbox_to_anchor=(1.02, 1), loc="upper left")
        plt.tight_layout()
        plt.show()

        plt.figure(figsize=(12, 5))
        for col in pivot_added.columns:
            plt.plot(pivot_added.index, pivot_added[col], marker="o", linewidth=1, label=col)
        plt.title(f"Lines added per week (top {len(top_devs)} devs)")
        plt.xlabel("Week (UTC, Monday start)")
        plt.ylabel("Lines added")
        plt.grid(True, alpha=0.3)
        plt.legend(bbox_to_anchor=(1.02, 1), loc="upper left")
        plt.tight_layout()
        plt.show()

        plt.figure(figsize=(12, 5))
        for col in pivot_net.columns:
            plt.plot(pivot_net.index, pivot_net[col], marker="o", linewidth=1, label=col)
        plt.title(f"Net lines (added-removed) per week (top {len(top_devs)} devs)")
        plt.xlabel("Week (UTC, Monday start)")
        plt.ylabel("Net lines")
        plt.grid(True, alpha=0.3)
        plt.legend(bbox_to_anchor=(1.02, 1), loc="upper left")
        plt.tight_layout()
        plt.show()

    # Leaderboard summary
    leaderboard = (
        weekly.groupby("author", as_index=False)
              .agg(
                  commits=("commits", "sum"),
                  lines_added=("lines_added", "sum"),
                  lines_removed=("lines_removed", "sum"),
                  lines_net=("lines_net", "sum"),
                  files_changed=("files_changed", "sum"),
                  repos_touched=("repos_touched", "sum"),
                  active_weeks=("week_start_utc", "nunique"),
              )
              .sort_values(["commits", "lines_added"], ascending=False)
    )
    print("\nDeveloper leaderboard (whole window):")
    display(leaderboard.head(25))

print("\nDone.")


# In[19]:


# SCM-Manager (Cloudogu) weekly developer KPI from changesets/commits + diff line counting
# ONE CELL. No pip installs. Uses stdlib (+ pandas/matplotlib if available).

import json, os, time, re
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin

# -----------------------------
# CONFIG
# -----------------------------
HOST = "http://172.31.200.215:8080"   # host only
DAYS_BACK = 720
PAGE_SIZE = 50                        # SCM-Manager uses page/pageSize
TOP_N_DEVS = 10
MAX_REPOS = None                      # None = all
MAX_CHANGESETS_PER_REPO = None        # optional cap per repo
SLEEP_SEC = 0.0
TIMEOUT_SEC = 60

# Use env var if you don't want to paste token in notebook:
#   set BB_TOKEN=... (or in notebook: os.environ["BB_TOKEN"]="...")
TOKEN = "eyJhcGlLZXlJZCI6IjFmVjZUOGVtUlkiLCJ1c2VyIjoiaXZhbi5rb2J5YWtvdiIsInBhc3NwaHJhc2UiOiI0WDQ5VkFFdWhmaTRQSzk2NEJ4SSJ9"
if not TOKEN:
    TOKEN = input("Paste SCM-Manager API key/token (won't be printed): ").strip()

# -----------------------------
# Optional libs
# -----------------------------
try:
    import pandas as pd
except Exception:
    pd = None

try:
    import plotly.graph_objects as go
    import plotly.express as px
    from plotly.subplots import make_subplots
except Exception:
    go = None
    px = None

# -----------------------------
# HTTP helpers
# -----------------------------
def _headers():
    # SCM-Manager docs show API keys via cookie X-Bearer-Token :contentReference[oaicite:3]{index=3}
    # Access tokens can be used as Authorization: Bearer ... :contentReference[oaicite:4]{index=4}
    return {
        "Accept": "*/*",
        "Cookie": f"X-Bearer-Token={TOKEN}",
        "Authorization": f"Bearer {TOKEN}",   # some installs accept this; harmless if ignored
    }

def http_get(url, accept=None):
    h = _headers()
    if accept:
        h["Accept"] = accept
    req = Request(url, headers=h)
    if SLEEP_SEC:
        time.sleep(SLEEP_SEC)
    with urlopen(req, timeout=TIMEOUT_SEC) as resp:
        return resp.read()

def http_get_json(url):
    return json.loads(http_get(url).decode("utf-8", errors="replace"))

def detect_api_root():
    # Most common for your UI (/scm/...): /scm/api/v2
    candidates = [HOST.rstrip("/") + "/scm/api/v2", HOST.rstrip("/") + "/api/v2"]
    errs = []
    for root in candidates:
        try:
            # repositories endpoint exists per SCM-Manager test cases
            # Try with different Accept headers as some servers are picky
            url = root.rstrip("/") + "/repositories?pageSize=1&page=0"
            req = Request(url, headers=_headers())
            # Override Accept header - try with wildcard
            req.add_header("Accept", "*/*")
            with urlopen(req, timeout=TIMEOUT_SEC) as resp:
                content = resp.read()
                # Try to parse as JSON
                json.loads(content.decode("utf-8", errors="replace"))
            print("Using API root:", root)
            return root
        except HTTPError as e:
            errs.append((root, f"HTTP {e.code}"))
        except Exception as e:
            errs.append((root, f"{e}"))
    print("API root detection failed; tried:")
    for u, m in errs:
        print(" ", u, "->", m)
    raise RuntimeError("Could not reach SCM-Manager API. Check HOST, token, and whether API is /scm/api/v2 or /api/v2.")

API = detect_api_root().rstrip("/")

def resolve_link(link_value):
    # SCM-Manager typically returns absolute or relative hrefs under _links
    if not link_value:
        return None
    href = link_value.get("href") if isinstance(link_value, dict) else link_value
    if not href:
        return None
    if href.startswith("http://") or href.startswith("https://"):
        return href
    # href may already include /scm/api/v2/..., so join with HOST
    return urljoin(HOST.rstrip("/") + "/", href.lstrip("/"))

def paginate_embedded(url, embedded_key):
    """
    SCM-Manager pagination is page/pageSize (see test cases) :contentReference[oaicite:6]{index=6}
    We iterate pages until no next/last hint.
    """
    page = 0
    while True:
        u = url + ("&" if "?" in url else "?") + urlencode({"page": page, "pageSize": PAGE_SIZE})
        data = http_get_json(u)
        embedded = (data.get("_embedded") or {})
        items = embedded.get(embedded_key) or []
        for it in items:
            yield it
        links = data.get("_links") or {}
        # If there's a "next" link, continue; otherwise stop.
        if "next" in links:
            page += 1
            continue
        # Some responses include page/pageTotal; use it if present
        page_total = data.get("pageTotal")
        if isinstance(page_total, int) and page + 1 < page_total:
            page += 1
            continue
        break

# -----------------------------
# Domain logic
# -----------------------------
def parse_any_datetime(val):
    # Supports epoch millis or ISO-like strings
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # SCM-Manager often uses ISO strings, but handle millis just in case
        if val > 10_000_000_000:  # millis
            return datetime.fromtimestamp(val/1000, tz=timezone.utc)
        return datetime.fromtimestamp(val, tz=timezone.utc)
    if isinstance(val, str):
        s = val.strip()
        s = s.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            return None
    return None

def week_start_utc(dt):
    d = dt.date()
    monday = d - timedelta(days=d.weekday())
    return datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc)

def count_diff_stats(diff_text):
    added = removed = 0
    files = set()

    # file boundary heuristics for git/hg/svn-ish diffs
    # - git: "diff --git a/... b/..."
    # - svn: "Index: path"
    # - hg: "diff -r ..." often followed by "diff --git" too in some modes
    for line in diff_text.splitlines():
        if line.startswith("diff --git "):
            files.add(line.strip())
            continue
        if line.startswith("Index: "):
            files.add(line.strip())
            continue

        # line counts: ignore headers
        if line.startswith("+++ ") or line.startswith("--- "):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1

    return added, removed, len(files)

# -----------------------------
# 1) list repos
# -----------------------------
repos_url = API + "/repositories"
repos = list(paginate_embedded(repos_url, "repositories"))
if MAX_REPOS:
    repos = repos[:MAX_REPOS]
print(f"Repositories found: {len(repos)}")

cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
print(f"Window: last {DAYS_BACK} days (since {cutoff.date()} UTC)")

rows = []

# -----------------------------
# 2) per repo: fetch branches, then changesets from all branches
# -----------------------------
for idx, repo in enumerate(repos, 1):
    ns = repo.get("namespace")
    name = repo.get("name")
    rtype = repo.get("type")
    if not ns or not name:
        continue

    # fetch repo detail to discover links
    try:
        detail = http_get_json(f"{API}/repositories/{ns}/{name}")
    except Exception as e:
        print(f"[WARN] repo detail failed {ns}/{name}: {e}")
        continue

    # Get all branches for this repository
    branches_to_process = []
    links = detail.get("_links") or {}
    
    # Try to get branches
    branches_link = None
    for key in ["branches", "refs"]:
        if key in links:
            branches_link = resolve_link(links[key])
            break
    
    if not branches_link:
        branches_link = f"{API}/repositories/{ns}/{name}/branches"
    
    try:
        # Fetch all branches
        for branch in paginate_embedded(branches_link, "branches"):
            branch_name = branch.get("name")
            if branch_name:
                branches_to_process.append(branch_name)
        if not branches_to_process:
            # If no branches found, try without branch specification (default)
            branches_to_process = [None]
        print(f"  [{ns}/{name}] Found {len(branches_to_process)} branch(es)")
    except Exception as e:
        print(f"[WARN] cannot list branches for {ns}/{name}: {e}, trying default branch")
        branches_to_process = [None]

    # Process changesets from each branch
    for branch_name in branches_to_process:
        # try common link keys
        changesets_link = None
        for key in ["changesets", "commits", "log", "history"]:
            if key in links:
                changesets_link = resolve_link(links[key])
                break

        if not changesets_link:
            changesets_link = f"{API}/repositories/{ns}/{name}/changesets"
        
        # Add branch parameter if we have a specific branch
        if branch_name:
            changesets_link = changesets_link + ("&" if "?" in changesets_link else "?") + urlencode({"branch": branch_name})

        # determine embedded key by probing once
        try:
            probe = http_get_json(changesets_link + ("&page=0&pageSize=1" if "?" in changesets_link else "?page=0&pageSize=1"))
        except Exception as e:
            print(f"[WARN] cannot list changesets for {ns}/{name} branch={branch_name}: {e}")
            continue

        embedded = (probe.get("_embedded") or {})
        if "changesets" in embedded:
            emb_key = "changesets"
        elif "commits" in embedded:
            emb_key = "commits"
        else:
            # fallback: pick first embedded list key
            emb_key = next(iter(embedded.keys()), None)

        if not emb_key:
            continue

        # iterate changesets
        seen = 0
        for cs in paginate_embedded(changesets_link, emb_key):
            seen += 1
            if MAX_CHANGESETS_PER_REPO and seen > MAX_CHANGESETS_PER_REPO:
                break

            # date fields vary; try common names
            dt = (parse_any_datetime(cs.get("date")) or
                  parse_any_datetime(cs.get("timestamp")) or
                  parse_any_datetime(cs.get("creationDate")))
            if not dt:
                continue
            if dt < cutoff:
                # stop early once we're past cutoff (assumes API returns newest-first; common in practice)
                # if your server returns oldest-first, comment this out.
                break

            author = cs.get("author") or {}
            author_name = author.get("name") or author.get("displayName") or cs.get("authorName") or "unknown"

            cs_links = cs.get("_links") or {}
            diff_url = None
            for dk in ["diff", "patch"]:
                if dk in cs_links:
                    diff_url = resolve_link(cs_links[dk])
                    break
            if not diff_url:
                # conventional diff endpoint guess
                # (won't always exist, but gives a shot)
                cs_id = cs.get("id") or cs.get("revision") or cs.get("changesetId")
                if cs_id:
                    diff_url = f"{API}/repositories/{ns}/{name}/changesets/{cs_id}/diff"

            added = removed = files_changed = 0
            
            if diff_url:
                # Try multiple approaches to get diff
                # First attempt with text/plain often fails with 406, so try */* as fallback
                diff_text = None
                attempts = [
                    ("text/plain", diff_url),
                    ("*/*", diff_url),
                ]
                
                for accept_header, url in attempts:
                    try:
                        diff_bytes = http_get(url, accept=accept_header)
                        diff_text = diff_bytes.decode("utf-8", errors="replace")
                        
                        # Check if we got actual diff content
                        if diff_text and (
                            "diff --git" in diff_text or 
                            "@@" in diff_text or 
                            "Index:" in diff_text or
                            "---" in diff_text
                        ):
                            added, removed, files_changed = count_diff_stats(diff_text)
                            break
                        elif diff_text.startswith("{"):
                            # Got JSON response, try to parse it
                            try:
                                diff_json = json.loads(diff_text)
                                # SCM-Manager may return diff in JSON format
                                if "files" in diff_json:
                                    for file_info in diff_json.get("files", []):
                                        files_changed += 1
                                        # Check for hunks or changes
                                        for hunk in file_info.get("hunks", []):
                                            for change in hunk.get("changes", []):
                                                change_type = change.get("type", "")
                                                if change_type == "insert":
                                                    added += 1
                                                elif change_type == "delete":
                                                    removed += 1
                                break
                            except:
                                pass
                    except:
                        # Try next method
                        continue

            rows.append({
                "namespace": ns,
                "repo": name,
                "type": rtype,
                "branch": branch_name or "default",
                "author": author_name,
                "datetime_utc": dt,
                "week_start_utc": week_start_utc(dt),
                "added": added,
                "removed": removed,
                "net": added - removed,
                "files_changed": files_changed,
                "changesets": 1,
            })

    if idx % 10 == 0:
        print(f"  processed {idx}/{len(repos)} repos…")

if not rows:
    raise RuntimeError("No changesets found in the selected window (or API endpoints differ on your server).")

print(f"Changesets collected: {len(rows)}")

# -----------------------------
# 3) aggregate + visualize
# -----------------------------
if pd is None:
    # minimal fallback
    agg = {}
    for r in rows:
        key = (r["week_start_utc"].date().isoformat(), r["author"])
        a = agg.setdefault(key, {"changesets":0, "added":0, "removed":0, "net":0, "files":0})
        a["changesets"] += 1
        a["added"] += r["added"]
        a["removed"] += r["removed"]
        a["net"] += r["net"]
        a["files"] += r["files_changed"]
    top = {}
    for (_, author), v in agg.items():
        top[author] = top.get(author, 0) + v["changesets"]
    top = sorted(top.items(), key=lambda x: x[1], reverse=True)[:TOP_N_DEVS]
    print("Top devs by changesets:")
    for a,c in top:
        print(" ", a, c)
else:
    df = pd.DataFrame(rows)
    df["week_start_utc"] = pd.to_datetime(df["week_start_utc"], utc=True)

    # Export raw changeset-level detail
    detail_cols = df[[
        "repo",          # project/repository
        "branch",
        "author",
        "changesets",
        "net",
        "removed",
        "added",
        "datetime_utc",
    ]].copy()
    detail_cols = detail_cols.rename(columns={
        "repo": "project",
        "author": "developer",
        "changesets": "commits",
        "removed": "deleted_rows",
        "added": "added_rows",
        "net": "net_rows",
    })
    detail_cols.to_csv("dev_kpi_changesets.csv", index=False)
    print("[OK] Saved detailed changesets: dev_kpi_changesets.csv")

    weekly = (df.groupby(["week_start_utc","author"], as_index=False)
                .agg(
                    changesets=("changesets","sum"),
                    lines_added=("added","sum"),
                    lines_removed=("removed","sum"),
                    lines_net=("net","sum"),
                    files_changed=("files_changed","sum"),
                    repos_touched=("repo", pd.Series.nunique),
                    branches_touched=("branch", pd.Series.nunique),
                )
                .sort_values(["week_start_utc","changesets"], ascending=[True, False]))

    top_devs = (weekly.groupby("author")["changesets"].sum()
                      .sort_values(ascending=False).head(TOP_N_DEVS).index.tolist())
    weekly_top = weekly[weekly["author"].isin(top_devs)].copy()

    print("\n" + "="*80)
    print("DETAILED WEEKLY ANALYSIS (Top Developers)")
    print("="*80)
    
    for week in sorted(weekly_top["week_start_utc"].unique()):
        week_data = weekly_top[weekly_top["week_start_utc"] == week].sort_values("changesets", ascending=False)
        print(f"\n[Week] starting: {week.date()}")
        print("-" * 80)
        for _, row in week_data.iterrows():
            print(f"  {row['author']:20s} | "
                  f"Commits: {int(row['changesets']):3d} | "
                  f"Lines +{int(row['lines_added']):4d} -{int(row['lines_removed']):4d} "
                  f"(net: {int(row['lines_net']):+5d}) | "
                  f"Files: {int(row['files_changed']):3d} | "
                  f"Repos: {int(row['repos_touched']):2d} | "
                  f"Branches: {int(row['branches_touched']):2d}")
    
    print("\n" + "="*80)
    print("SUMMARY BY DEVELOPER (Total for period)")
    print("="*80)
    summary = df.groupby("author").agg(
        total_changesets=("changesets", "sum"),
        total_added=("added", "sum"),
        total_removed=("removed", "sum"),
        total_net=("net", "sum"),
        total_files=("files_changed", "sum"),
        repos_touched=("repo", pd.Series.nunique),
        branches_touched=("branch", pd.Series.nunique)
    ).sort_values("total_changesets", ascending=False).head(TOP_N_DEVS)
    
    for author, row in summary.iterrows():
        print(f"\n[Developer] {author}")
        print(f"   Total Commits:     {int(row['total_changesets'])}")
        print(f"   Lines Added:       +{int(row['total_added'])}")
        print(f"   Lines Removed:     -{int(row['total_removed'])}")
        print(f"   Net Lines:         {int(row['total_net']):+d}")
        print(f"   Files Changed:     {int(row['total_files'])}")
        print(f"   Repositories:      {int(row['repos_touched'])}")
        print(f"   Branches Touched:  {int(row['branches_touched'])}")

    weekly.to_csv("dev_kpi_weekly.csv", index=False)
    print("\n" + "="*80)
    print("[OK] Saved: dev_kpi_weekly.csv")

    if go is not None:
        # Create interactive plotly charts
        piv_changesets = weekly_top.pivot(index="week_start_utc", columns="author", values="changesets").fillna(0).sort_index()
        piv_added = weekly_top.pivot(index="week_start_utc", columns="author", values="lines_added").fillna(0).sort_index()
        piv_removed = weekly_top.pivot(index="week_start_utc", columns="author", values="lines_removed").fillna(0).sort_index()
        piv_net = weekly_top.pivot(index="week_start_utc", columns="author", values="lines_net").fillna(0).sort_index()
        piv_files = weekly_top.pivot(index="week_start_utc", columns="author", values="files_changed").fillna(0).sort_index()

        # Consistent developer color mapping across all developer visualizations
        dev_names = list(piv_changesets.columns)
        base_palette = px.colors.qualitative.Plotly
        if len(dev_names) > len(base_palette):
            palette_extended = base_palette * (len(dev_names) // len(base_palette) + 1)
        else:
            palette_extended = base_palette
        dev_color_map = {name: palette_extended[i] for i, name in enumerate(dev_names)}

        # Project/branch/developer summary for requested logic
        detail_viz = detail_cols.copy()
        detail_viz["datetime_utc"] = pd.to_datetime(detail_viz["datetime_utc"], utc=True)
        summary_pbd = (detail_viz
            .groupby(["project","branch","developer"], as_index=False)
            .agg(
                commits=("commits","sum"),
                added_rows=("added_rows","sum"),
                deleted_rows=("deleted_rows","sum"),
                net_rows=("net_rows","sum"),
                first_datetime=("datetime_utc","min"),
                last_datetime=("datetime_utc","max"),
            )
            .sort_values(["project","branch","developer"]))

        # Table view
        fig_table = go.Figure(data=[go.Table(
            header=dict(values=["Project","Branch","Developer","Commits","Net Rows","Deleted Rows","Added Rows","First Datetime","Last Datetime"],
                        fill_color="#222",
                        font=dict(color="white"),
                        align="left"),
            cells=dict(values=[
                summary_pbd["project"],
                summary_pbd["branch"],
                summary_pbd["developer"],
                summary_pbd["commits"],
                summary_pbd["net_rows"],
                summary_pbd["deleted_rows"],
                summary_pbd["added_rows"],
                summary_pbd["first_datetime"].dt.strftime("%Y-%m-%d %H:%M"),
                summary_pbd["last_datetime"].dt.strftime("%Y-%m-%d %H:%M"),
            ], align="left")
        )])
        fig_table.update_layout(title="Project / Branch / Developer KPI (summary)")
        fig_table.write_html("project_branch_developer_table.html")
        print("[OK] Saved chart: project_branch_developer_table.html")
        print("Summary (table): rows=", len(summary_pbd))

        # Bar chart: commits and net rows by developer grouped by project/branch
        melted = summary_pbd.melt(id_vars=["project","branch","developer"], value_vars=["commits","net_rows","added_rows","deleted_rows"], var_name="metric", value_name="value")
        fig_bar = px.bar(
            melted,
            x="developer",
            y="value",
            color="metric",
            facet_row="project",
            facet_col="branch",
            title="Project / Branch / Developer metrics",
            labels={"value":"Count / Lines","developer":"Developer"},
            height=700,
        )
        fig_bar.update_layout(legend_title="Metric", hovermode="closest")
        fig_bar.write_html("project_branch_developer_bars.html")
        print("[OK] Saved chart: project_branch_developer_bars.html")
        print("Summary (bars): projects=", summary_pbd["project"].nunique(), "branches=", summary_pbd["branch"].nunique(), "developers=", summary_pbd["developer"].nunique())

        # Project-only summary
        summary_proj = (detail_viz
            .groupby(["project"], as_index=False)
            .agg(
                commits=("commits","sum"),
                added_rows=("added_rows","sum"),
                deleted_rows=("deleted_rows","sum"),
                net_rows=("net_rows","sum"),
            )
            .sort_values("commits", ascending=False))

        fig_proj = px.bar(
            summary_proj.melt(id_vars=["project"], value_vars=["commits","net_rows","added_rows","deleted_rows"], var_name="metric", value_name="value"),
            x="project",
            y="value",
            color="metric",
            barmode="group",
            title="Project metrics",
            labels={"value":"Count / Lines","project":"Project"},
            height=500,
        )
        fig_proj.update_layout(legend_title="Metric", hovermode="closest")
        fig_proj.write_html("project_metrics_bars.html")
        print("[OK] Saved chart: project_metrics_bars.html")
        print("Summary (project): projects=", len(summary_proj), "total commits=", int(summary_proj["commits"].sum()))

        # Branch-level summary (project+branch)
        summary_branch = (detail_viz
            .groupby(["project","branch"], as_index=False)
            .agg(
                commits=("commits","sum"),
                added_rows=("added_rows","sum"),
                deleted_rows=("deleted_rows","sum"),
                net_rows=("net_rows","sum"),
            )
            .sort_values(["project","commits"], ascending=[True, False]))

        fig_branch = px.bar(
            summary_branch.melt(id_vars=["project","branch"], value_vars=["commits","net_rows","added_rows","deleted_rows"], var_name="metric", value_name="value"),
            x="branch",
            y="value",
            color="metric",
            facet_row="project",
            title="Branch metrics (per project)",
            labels={"value":"Count / Lines","branch":"Branch"},
            height=700,
        )
        fig_branch.update_layout(legend_title="Metric", hovermode="closest")
        fig_branch.write_html("branch_metrics_bars.html")
        print("[OK] Saved chart: branch_metrics_bars.html")
        print("Summary (branch): branches=", len(summary_branch), "total commits=", int(summary_branch["commits"].sum()))

        # Create separate visualizations for each project/branch combination
        print("\n" + "="*80)
        print("GENERATING INDIVIDUAL PROJECT/BRANCH VISUALIZATIONS")
        print("="*80)
        
        for proj in sorted(detail_viz["project"].unique()):
            proj_data = detail_viz[detail_viz["project"] == proj]
            branches = sorted(proj_data["branch"].unique())
            
            for branch in branches:
                branch_data = proj_data[proj_data["branch"] == branch].sort_values("datetime_utc")
                
                if len(branch_data) == 0:
                    continue
                
                # Create cumulative lines visualization
                branch_data_sorted = branch_data.sort_values("datetime_utc").reset_index(drop=True)
                branch_data_sorted["cumulative_added"] = branch_data_sorted["added_rows"].cumsum()
                branch_data_sorted["cumulative_deleted"] = branch_data_sorted["deleted_rows"].cumsum()
                branch_data_sorted["cumulative_net"] = branch_data_sorted["net_rows"].cumsum()
                branch_data_sorted["cumulative_commits"] = branch_data_sorted["commits"].cumsum()
                
                # Safe filename
                safe_proj = proj.replace("/", "_").replace("\\", "_").replace(" ", "_")
                safe_branch = branch.replace("/", "_").replace("\\", "_").replace(" ", "_")
                filename = f"branch_{safe_proj}_{safe_branch}.html"
                
                # Create figure with secondary y-axis
                fig_pb = make_subplots(specs=[[{"secondary_y": True}]])
                
                fig_pb.add_trace(
                    go.Scatter(x=branch_data_sorted["datetime_utc"], y=branch_data_sorted["cumulative_commits"],
                               mode='lines+markers', name='Cumulative Commits', line=dict(color='#1f77b4')),
                    secondary_y=False
                )
                
                fig_pb.add_trace(
                    go.Scatter(x=branch_data_sorted["datetime_utc"], y=branch_data_sorted["cumulative_net"],
                               mode='lines+markers', name='Cumulative Net Lines', line=dict(color='#ff7f0e', dash='dash')),
                    secondary_y=True
                )
                
                fig_pb.update_layout(
                    title_text=f"Project: {proj} | Branch: {branch}",
                    xaxis_title="Date",
                    height=500,
                    hovermode='x unified',
                    template='plotly_white'
                )
                fig_pb.update_yaxes(title_text="Cumulative Commits", secondary_y=False)
                fig_pb.update_yaxes(title_text="Cumulative Net Lines", secondary_y=True)
                
                fig_pb.write_html(filename)
                
                total_commits = branch_data["commits"].sum()
                total_added = branch_data["added_rows"].sum()
                total_deleted = branch_data["deleted_rows"].sum()
                total_net = branch_data["net_rows"].sum()
                dev_count = branch_data["developer"].nunique()
                
                print(f"  ✓ {filename}")
                print(f"    Commits: {int(total_commits)}, +{int(total_added)}/{int(total_deleted)} lines, {int(total_net):+d} net, {dev_count} devs")
        
        # Special visualization for Billing project across all branches
        if "Billing" in detail_viz["project"].unique() or "billing" in detail_viz["project"].unique().str.lower():
            billing_projects = detail_viz[detail_viz["project"].str.lower() == "billing"]["project"].unique()
            if len(billing_projects) > 0:
                billing_proj_name = billing_projects[0]
                billing_data = detail_viz[detail_viz["project"] == billing_proj_name].sort_values("datetime_utc")
                
                print("\n" + "="*80)
                print(f"CREATING SPECIAL DASHBOARD FOR '{billing_proj_name}' PROJECT")
                print("="*80)
                
                # Group by branch and week for time-series
                billing_data["week_start"] = pd.to_datetime(billing_data["datetime_utc"]).dt.to_period('W').apply(lambda r: r.start_time)
                billing_weekly = (billing_data
                    .groupby(["week_start", "branch"], as_index=False)
                    .agg(
                        commits=("commits","sum"),
                        added_rows=("added_rows","sum"),
                        deleted_rows=("deleted_rows","sum"),
                        net_rows=("net_rows","sum"),
                    )
                    .sort_values("week_start"))
                
                # Detect merge commits: look for patterns in commit messages (would need API enhancement)
                # For now, we infer merges as significant line additions/reductions on master
                billing_master = billing_data[billing_data["branch"] == "master"].sort_values("datetime_utc")
                
                # Create multi-branch timeline
                fig_billing = go.Figure()
                
                for branch in sorted(billing_data["branch"].unique()):
                    branch_weekly = billing_weekly[billing_weekly["branch"] == branch]
                    
                    # Determine line style and width based on branch type
                    if branch.lower() == "master":
                        line_dash = "solid"
                        line_width = 3
                    else:
                        line_dash = "dot" if "dev" in branch.lower() else "dash"
                        line_width = 2
                    
                    fig_billing.add_trace(go.Scatter(
                        x=branch_weekly["week_start"],
                        y=branch_weekly["commits"],
                        mode='lines+markers',
                        name=branch,
                        line=dict(dash=line_dash, width=line_width),
                        hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Commits: %{y}<extra></extra>'
                    ))
                
                fig_billing.update_layout(
                    title_text=f"'{billing_proj_name}' Project: Commits per Week (All Branches)",
                    xaxis_title="Week",
                    yaxis_title="Commits",
                    height=600,
                    hovermode='x unified',
                    template='plotly_white',
                    legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
                )
                fig_billing.write_html(f"billing_project_commits_timeline.html")
                print(f"  ✓ billing_project_commits_timeline.html (all branches)")
                
                # Net lines timeline
                fig_billing_net = go.Figure()
                
                for branch in sorted(billing_data["branch"].unique()):
                    branch_weekly = billing_weekly[billing_weekly["branch"] == branch]
                    
                    if branch.lower() == "master":
                        line_dash = "solid"
                        line_width = 3
                    else:
                        line_dash = "dot" if "dev" in branch.lower() else "dash"
                        line_width = 2
                    
                    fig_billing_net.add_trace(go.Scatter(
                        x=branch_weekly["week_start"],
                        y=branch_weekly["net_rows"],
                        mode='lines+markers',
                        name=branch,
                        line=dict(dash=line_dash, width=line_width),
                        hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Net Lines: %{y}<extra></extra>'
                    ))
                
                fig_billing_net.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.3)
                fig_billing_net.update_layout(
                    title_text=f"'{billing_proj_name}' Project: Net Lines per Week (All Branches) - Growth Analysis",
                    xaxis_title="Week",
                    yaxis_title="Net Lines (Added - Deleted)",
                    height=600,
                    hovermode='x unified',
                    template='plotly_white',
                    legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
                )
                fig_billing_net.write_html(f"billing_project_net_lines_timeline.html")
                print(f"  ✓ billing_project_net_lines_timeline.html (net lines growth)")
                
                # Master branch analysis with merge source detection
                if len(billing_master) > 0:
                    billing_master_sorted = billing_master.sort_values("datetime_utc").reset_index(drop=True)
                    billing_master_sorted["cumulative_commits"] = billing_master_sorted["commits"].cumsum()
                    billing_master_sorted["cumulative_added"] = billing_master_sorted["added_rows"].cumsum()
                    billing_master_sorted["cumulative_deleted"] = billing_master_sorted["deleted_rows"].cumsum()
                    billing_master_sorted["cumulative_net"] = billing_master_sorted["net_rows"].cumsum()
                    
                    # Detect potential merge commits (heuristic: commits where added + deleted > avg for this branch)
                    avg_changes = (billing_master_sorted["added_rows"] + billing_master_sorted["deleted_rows"]).mean()
                    billing_master_sorted["is_merge_candidate"] = (billing_master_sorted["added_rows"] + billing_master_sorted["deleted_rows"]) > avg_changes * 1.5
                    
                    # Detect merge source branches: look for developers active on non-master branches within time window
                    non_master_data = billing_data[billing_data["branch"] != "master"].sort_values("datetime_utc")
                    
                    # Create mapping: for each master commit, find likely source branch
                    def detect_merge_source(master_row):
                        """Try to find which branch a merge came from"""
                        # Look for developers who were active on non-master branches near this commit time
                        dev = master_row["developer"]
                        commit_time = master_row["datetime_utc"]
                        
                        # Window: 2 days before and 1 day after
                        time_window = timedelta(days=3)
                        
                        recent_dev_activity = non_master_data[
                            (non_master_data["developer"] == dev) &
                            (non_master_data["datetime_utc"] >= commit_time - time_window) &
                            (non_master_data["datetime_utc"] <= commit_time)
                        ]
                        
                        if len(recent_dev_activity) > 0:
                            # Find most active branch for this developer near this time
                            branch_counts = recent_dev_activity["branch"].value_counts()
                            if len(branch_counts) > 0:
                                return branch_counts.index[0]
                        return None
                    
                    billing_master_sorted["merge_source_branch"] = billing_master_sorted.apply(detect_merge_source, axis=1)
                    
                    # Assign colors to branches
                    all_source_branches = sorted(billing_master_sorted[billing_master_sorted["merge_source_branch"].notna()]["merge_source_branch"].unique())
                    branch_colors = {}
                    source_palette = px.colors.qualitative.Set2
                    for i, branch in enumerate(all_source_branches):
                        branch_colors[branch] = source_palette[i % len(source_palette)]
                    
                    fig_master = make_subplots(
                        rows=2, cols=1,
                        subplot_titles=("Master Branch: Cumulative Commits", "Master Branch: Commits by Type (Merge Source Detection)"),
                        vertical_spacing=0.15
                    )
                    
                    fig_master.add_trace(
                        go.Scatter(x=billing_master_sorted["datetime_utc"], y=billing_master_sorted["cumulative_commits"],
                                   mode='lines+markers', name='Cumulative Commits', line=dict(color='#1f77b4')),
                        row=1, col=1
                    )
                    
                    # Direct commits (no merge source detected)
                    direct = billing_master_sorted[billing_master_sorted["merge_source_branch"].isna()]
                    if len(direct) > 0:
                        fig_master.add_trace(
                            go.Scatter(x=direct["datetime_utc"], y=direct["net_rows"],
                                       mode='markers', name='Direct Pushes', marker=dict(size=8, color='#2ca02c'),
                                       hovertemplate='<b>Direct Push</b><br>Date: %{x}<br>Net Lines: %{y}<extra></extra>'),
                            row=2, col=1
                        )
                    
                    # Merges by source branch (color-coded)
                    for source_branch in all_source_branches:
                        merges_from_branch = billing_master_sorted[billing_master_sorted["merge_source_branch"] == source_branch]
                        if len(merges_from_branch) > 0:
                            fig_master.add_trace(
                                go.Scatter(x=merges_from_branch["datetime_utc"], y=merges_from_branch["net_rows"],
                                           mode='markers', name=f'From: {source_branch}',
                                           marker=dict(size=12, color=branch_colors[source_branch], symbol='star'),
                                           hovertemplate=f'<b>Merge from {source_branch}</b><br>Date: %{{x}}<br>Net Lines: %{{y}}<br>Dev: ' + merges_from_branch["developer"] + '<extra></extra>'),
                                row=2, col=1
                            )
                    
                    fig_master.update_xaxes(title_text="Date", row=2, col=1)
                    fig_master.update_yaxes(title_text="Commits", row=1, col=1)
                    fig_master.update_yaxes(title_text="Net Lines", row=2, col=1)
                    
                    fig_master.update_layout(
                        title_text=f"'{billing_proj_name}' Master Branch Analysis (Merge Source Detection)",
                        height=700,
                        hovermode='x unified',
                        template='plotly_white'
                    )
                    
                    fig_master.write_html(f"billing_project_master_analysis.html")
                    print(f"  ✓ billing_project_master_analysis.html (master with merge source)")
                    
                    # Calculate statistics
                    merges_with_source = billing_master_sorted[billing_master_sorted["merge_source_branch"].notna()]
                    direct_pushes = direct
                    
                    print(f"  Summary: Master has {len(billing_master)} commits")
                    print(f"    - {len(direct_pushes)} direct pushes (green circles)")
                    for source_branch in all_source_branches:
                        count = len(billing_master_sorted[billing_master_sorted["merge_source_branch"] == source_branch])
                        print(f"    - {count} merges from '{source_branch}' (colored stars)")
        else:
            print("[INFO] Billing project not found in data")

        # Project-level time series visualizations
        detail_viz["week_start"] = pd.to_datetime(detail_viz["datetime_utc"]).dt.to_period('W').apply(lambda r: r.start_time)
        
        project_weekly = (detail_viz
            .groupby(["week_start", "project"], as_index=False)
            .agg(
                commits=("commits","sum"),
                added_rows=("added_rows","sum"),
                deleted_rows=("deleted_rows","sum"),
                net_rows=("net_rows","sum"),
            ))
        
        # Project commits over time
        fig_proj_time = px.line(
            project_weekly,
            x="week_start",
            y="commits",
            color="project",
            markers=True,
            title="Project Activity: Commits per Week",
            labels={"week_start":"Week", "commits":"Commits", "project":"Project"},
            height=500,
        )
        fig_proj_time.update_layout(hovermode="x unified", template="plotly_white")
        fig_proj_time.write_html("project_commits_timeline.html")
        print("[OK] Saved chart: project_commits_timeline.html")
        proj_total_commits = project_weekly["commits"].sum()
        proj_total_weeks = project_weekly["week_start"].nunique()
        print(f"Summary: {len(summary_proj)} projects, {proj_total_weeks} weeks, {int(proj_total_commits)} total commits, avg {proj_total_commits/proj_total_weeks:.1f} commits/week")
        
        # Project lines added/deleted over time
        fig_proj_lines = go.Figure()
        for proj in project_weekly["project"].unique():
            proj_data = project_weekly[project_weekly["project"] == proj]
            fig_proj_lines.add_trace(go.Scatter(
                x=proj_data["week_start"],
                y=proj_data["added_rows"],
                mode='lines+markers',
                name=f"{proj} (added)",
                line=dict(dash='solid'),
                hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Lines: %{y}<extra></extra>'
            ))
            fig_proj_lines.add_trace(go.Scatter(
                x=proj_data["week_start"],
                y=proj_data["deleted_rows"],
                mode='lines+markers',
                name=f"{proj} (deleted)",
                line=dict(dash='dot'),
                hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Lines: %{y}<extra></extra>'
            ))
        fig_proj_lines.update_layout(
            title="Project Activity: Lines Added/Deleted per Week",
            xaxis_title="Week",
            yaxis_title="Lines",
            hovermode='x unified',
            template='plotly_white',
            height=500
        )
        fig_proj_lines.write_html("project_lines_timeline.html")
        print("[OK] Saved chart: project_lines_timeline.html")
        proj_total_added = project_weekly["added_rows"].sum()
        proj_total_deleted = project_weekly["deleted_rows"].sum()
        proj_total_net = project_weekly["net_rows"].sum()
        print(f"Summary: +{int(proj_total_added)} lines added, -{int(proj_total_deleted)} deleted, {int(proj_total_net):+d} net")

        # Branch-level time series visualizations
        branch_weekly = (detail_viz
            .groupby(["week_start", "project", "branch"], as_index=False)
            .agg(
                commits=("commits","sum"),
                added_rows=("added_rows","sum"),
                deleted_rows=("deleted_rows","sum"),
                net_rows=("net_rows","sum"),
            ))
        
        # Branch commits over time (faceted by project)
        fig_branch_time = px.line(
            branch_weekly,
            x="week_start",
            y="commits",
            color="branch",
            facet_row="project",
            markers=True,
            title="Branch Activity: Commits per Week (by Project)",
            labels={"week_start":"Week", "commits":"Commits", "branch":"Branch"},
            height=max(400, 300 * branch_weekly["project"].nunique()),
        )
        fig_branch_time.update_layout(hovermode="x unified", template="plotly_white")
        fig_branch_time.write_html("branch_commits_timeline.html")
        print("[OK] Saved chart: branch_commits_timeline.html")
        branch_total_commits = branch_weekly["commits"].sum()
        branch_total_weeks = branch_weekly["week_start"].nunique()
        branch_count = branch_weekly.groupby(["project","branch"]).ngroups
        print(f"Summary: {branch_count} branches across {branch_weekly['project'].nunique()} projects, {int(branch_total_commits)} total commits, avg {branch_total_commits/branch_total_weeks:.1f} commits/week")
        
        # Branch net lines over time (faceted by project)
        fig_branch_net = px.line(
            branch_weekly,
            x="week_start",
            y="net_rows",
            color="branch",
            facet_row="project",
            markers=True,
            title="Branch Activity: Net Lines per Week (by Project)",
            labels={"week_start":"Week", "net_rows":"Net Lines", "branch":"Branch"},
            height=max(400, 300 * branch_weekly["project"].nunique()),
        )
        fig_branch_net.update_layout(hovermode="x unified", template="plotly_white")
        fig_branch_net.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.3)
        fig_branch_net.write_html("branch_net_lines_timeline.html")
        print("[OK] Saved chart: branch_net_lines_timeline.html")
        branch_total_added = branch_weekly["added_rows"].sum()
        branch_total_deleted = branch_weekly["deleted_rows"].sum()
        branch_total_net = branch_weekly["net_rows"].sum()
        print(f"Summary: +{int(branch_total_added)} lines added, -{int(branch_total_deleted)} deleted, {int(branch_total_net):+d} net")
        
        # 1. Changesets per week
        fig1 = go.Figure()
        for col in piv_changesets.columns:
            fig1.add_trace(go.Scatter(
                x=piv_changesets.index, y=piv_changesets[col],
                mode='lines+markers', name=col,
                line=dict(color=dev_color_map.get(col)),
                marker=dict(color=dev_color_map.get(col)),
                hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Changesets: %{y}<extra></extra>'
            ))
        fig1.update_layout(
            title=f"Changesets per Week (Top {len(top_devs)} Developers)",
            xaxis_title="Week (UTC, Monday start)",
            yaxis_title="Changesets",
            hovermode='x unified',
            template='plotly_white'
        )
        fig1.write_html("changesets_per_week.html")
        print("[OK] Saved chart: changesets_per_week.html")
        dev_total_changesets = piv_changesets.sum().sum()
        dev_weeks = len(piv_changesets)
        print(f"Summary: {len(top_devs)} developers, {dev_weeks} weeks, {int(dev_total_changesets)} total changesets, avg {dev_total_changesets/dev_weeks:.1f} changesets/week")
        
        # 2. Lines added per week
        fig2 = go.Figure()
        for col in piv_added.columns:
            fig2.add_trace(go.Scatter(
                x=piv_added.index, y=piv_added[col],
                mode='lines+markers', name=col,
                line=dict(color=dev_color_map.get(col)),
                marker=dict(color=dev_color_map.get(col)),
                hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Lines Added: %{y}<extra></extra>'
            ))
        fig2.update_layout(
            title=f"Lines Added per Week (Top {len(top_devs)} Developers)",
            xaxis_title="Week (UTC, Monday start)",
            yaxis_title="Lines Added",
            hovermode='x unified',
            template='plotly_white'
        )
        fig2.write_html("lines_added_per_week.html")
        print("[OK] Saved chart: lines_added_per_week.html")
        dev_total_added = piv_added.sum().sum()
        dev_avg_added_per_week = dev_total_added / len(piv_added) if len(piv_added) > 0 else 0
        print(f"Summary: {int(dev_total_added)} total lines added, avg {dev_avg_added_per_week:.1f} lines/week")
        
        # 3. Net lines per week (NEW: with positive/negative coloring)
        fig3 = go.Figure()
        for col in piv_net.columns:
            fig3.add_trace(go.Scatter(
                x=piv_net.index, y=piv_net[col],
                mode='lines+markers', name=col,
                line=dict(color=dev_color_map.get(col)),
                marker=dict(color=dev_color_map.get(col)),
                hovertemplate='<b>%{fullData.name}</b><br>Week: %{x|%Y-%m-%d}<br>Net Lines: %{y}<extra></extra>'
            ))
        fig3.update_layout(
            title=f"Net Lines per Week (Top {len(top_devs)} Developers) - Added minus Removed",
            xaxis_title="Week (UTC, Monday start)",
            yaxis_title="Net Lines (Added - Removed)",
            hovermode='x unified',
            template='plotly_white'
        )
        fig3.add_hline(y=0, line_dash="dash", line_color="gray", opacity=0.5)
        fig3.write_html("net_lines_per_week.html")
        print("[OK] Saved chart: net_lines_per_week.html")
        dev_total_net = piv_net.sum().sum()
        dev_total_removed = piv_removed.sum().sum()
        dev_avg_net_per_week = dev_total_net / len(piv_net) if len(piv_net) > 0 else 0
        print(f"Summary: +{int(dev_total_added)} added, -{int(dev_total_removed)} removed, {int(dev_total_net):+d} net lines, avg {dev_avg_net_per_week:+.1f} net/week")
        
        # 4. Combined view with subplots
        fig_combined = make_subplots(
            rows=2, cols=2,
            subplot_titles=('Changesets', 'Lines Added', 'Net Lines', 'Files Changed'),
            vertical_spacing=0.12,
            horizontal_spacing=0.10
        )
        
        for col in piv_changesets.columns:
            fig_combined.add_trace(
                go.Scatter(x=piv_changesets.index, y=piv_changesets[col], mode='lines+markers', name=col, showlegend=True,
                           line=dict(color=dev_color_map.get(col)), marker=dict(color=dev_color_map.get(col))),
                row=1, col=1
            )
            fig_combined.add_trace(
                go.Scatter(x=piv_added.index, y=piv_added[col], mode='lines+markers', name=col, showlegend=False,
                           line=dict(color=dev_color_map.get(col)), marker=dict(color=dev_color_map.get(col))),
                row=1, col=2
            )
            fig_combined.add_trace(
                go.Scatter(x=piv_net.index, y=piv_net[col], mode='lines+markers', name=col, showlegend=False,
                           line=dict(color=dev_color_map.get(col)), marker=dict(color=dev_color_map.get(col))),
                row=2, col=1
            )
            fig_combined.add_trace(
                go.Scatter(x=piv_files.index, y=piv_files[col], mode='lines+markers', name=col, showlegend=False,
                           line=dict(color=dev_color_map.get(col)), marker=dict(color=dev_color_map.get(col))),
                row=2, col=2
            )
        
        fig_combined.update_xaxes(title_text="Week", row=2, col=1)
        fig_combined.update_xaxes(title_text="Week", row=2, col=2)
        fig_combined.update_yaxes(title_text="Count", row=1, col=1)
        fig_combined.update_yaxes(title_text="Lines", row=1, col=2)
        fig_combined.update_yaxes(title_text="Net Lines", row=2, col=1)
        fig_combined.update_yaxes(title_text="Files", row=2, col=2)
        
        fig_combined.update_layout(
            title_text=f"Developer KPIs - Complete Overview (Top {len(top_devs)} Developers)",
            height=800,
            hovermode='x unified',
            template='plotly_white'
        )
        fig_combined.write_html("developer_kpis_combined.html")
        print("[OK] Saved chart: developer_kpis_combined.html")
        dev_total_files = piv_files.sum().sum()
        dev_avg_files_per_week = dev_total_files / len(piv_files) if len(piv_files) > 0 else 0
        print(f"Summary (combined): {len(top_devs)} developers, {len(piv_changesets)} weeks, {int(dev_total_changesets)} changesets, {int(dev_total_files)} files, {int(dev_total_net):+d} net lines")
        
    else:
        print("[WARN] plotly not available -> skipping charts.")

print("Done.")


# In[1]:


pip install requests pandas matplotlib python-dateutil tqdm


# In[ ]:




