# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
🧠 What Can You Do?

Right now, this is just a starting point — the perfect place to begin building and testing your Spark applications.

🧹 Just Exploring?
No problem! If you were just checking things out and don’t need to keep this code:

- Simply delete your Spark.
- Everything will be cleaned up — no traces left behind.

📄 License For Spark Template Resources 

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## SCM Integration (Repositories)

This app can load repositories from your internal SCM API.

- Configure environment variables by copying `.env.example` to `.env.local` and filling values:

```
VITE_SCM_BASE_URL=http://172.31.200.215:8080
# Prefer a token when available
VITE_SCM_TOKEN=YOUR_TOKEN
# Or use basic auth (not both)
VITE_SCM_USERNAME=YOUR_USER
VITE_SCM_PASSWORD=YOUR_PASSWORD
```

- Start the app:

```
npm install
npm run dev
```

If the SCM API is unreachable or misconfigured, the app falls back to mock repository data.
