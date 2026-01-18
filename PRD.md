# Planning Guide

A developer analytics dashboard that provides insights into individual coder performance and overall team metrics, simulating integration patterns for Git repositories and SharePoint-style collaboration data.

**Experience Qualities**: 
1. **Data-Driven** - Every metric should feel purposeful and actionable, presenting clear insights at a glance
2. **Professional** - The interface should feel like an enterprise-grade analytics tool with polish and sophistication
3. **Comprehensive** - Users should be able to drill down from high-level team views to individual contributor details seamlessly

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This application requires multiple coordinated views (team overview, individual profiles, repository analytics), persistent state management, data visualization, and sophisticated filtering/sorting capabilities.

## Essential Features

### Team Dashboard Overview
- **Functionality**: Displays aggregate metrics for the entire development team including commit counts, code review stats, active repositories, and productivity trends
- **Purpose**: Provides management and team leads with a bird's-eye view of team health and productivity
- **Trigger**: Default landing view when app loads
- **Progression**: App loads → Team metrics displayed with charts → User can filter by date range → Charts update in real-time
- **Success criteria**: All team members' contributions are aggregated accurately, charts render smoothly, date filtering works correctly

### Individual Coder Analytics
- **Functionality**: Shows detailed metrics for a specific developer including commits over time, code churn, review participation, language breakdown, and activity patterns
- **Purpose**: Enables performance reviews, identifies training needs, and celebrates individual achievements
- **Trigger**: User clicks on a team member from the dashboard or selects from a dropdown
- **Progression**: Click coder name → Profile view loads → Detailed charts appear → User can toggle between different metric views → Export/share options available
- **Success criteria**: Individual metrics are accurate, charts are interactive, comparison to team average is clear

### Repository Insights
- **Functionality**: Lists all tracked repositories with contribution statistics, activity levels, primary contributors, and health indicators
- **Purpose**: Helps identify which projects need attention, which are thriving, and where resources should be allocated
- **Trigger**: User navigates to repositories tab
- **Progression**: Navigate to repos → List appears with sortable columns → Click repository → Detailed view with contributor breakdown → Filter by date range or activity level
- **Success criteria**: Repositories are sortable by multiple criteria, contributor breakdown is accurate, activity trends are visible

### Date Range Filtering
- **Functionality**: Allows users to scope all analytics to specific time periods (last 7 days, 30 days, 90 days, or custom range)
- **Purpose**: Enables temporal analysis and trend identification across different time horizons
- **Trigger**: User clicks date range selector in header
- **Progression**: Click date selector → Calendar/preset options appear → Select range → All metrics recalculate → Charts animate to new values
- **Success criteria**: All visualizations update simultaneously, data remains consistent across views, custom ranges work correctly

### Developer Comparison Mode
- **Functionality**: Side-by-side comparison of multiple developers' metrics
- **Purpose**: Facilitates performance reviews and helps identify mentorship opportunities
- **Trigger**: User selects "Compare" button and chooses 2-4 developers
- **Progression**: Click compare → Multi-select dialog appears → Choose developers → Split-screen comparison view → Toggle between metric categories
- **Success criteria**: Comparisons are visually clear, metrics are normalized for fair comparison, data loads efficiently

## Edge Case Handling

- **No Data Available**: Display empty state illustrations with helpful guidance on what data would appear
- **Single Developer**: Adjust UI to show that team comparisons aren't meaningful, focus on temporal trends instead
- **Extreme Values**: Cap chart scales intelligently to prevent outliers from distorting visualization usefulness
- **Long Repository Names**: Truncate with ellipsis and show full name on hover to maintain layout integrity
- **Rapid Filter Changes**: Debounce filter applications to prevent performance issues from excessive recalculations
- **Future Dates**: Prevent selection of date ranges that extend beyond current date

## Design Direction

The design should evoke confidence, clarity, and technological sophistication. It should feel like a premium analytics platform that respects the user's time by presenting dense information clearly. Think modern SaaS dashboard with a focus on data visualization - clean, professional, with moments of visual interest through well-designed charts and subtle animations.

## Color Selection

A tech-forward palette with deep blues conveying professionalism and trust, complemented by vibrant accent colors for data visualization.

- **Primary Color**: Deep tech blue (`oklch(0.35 0.12 250)`) - Conveys professionalism, stability, and technical expertise
- **Secondary Colors**: Cool slate (`oklch(0.50 0.02 240)`) for secondary UI elements and backgrounds that recede; Light blue-gray (`oklch(0.92 0.01 240)`) for cards and subtle backgrounds
- **Accent Color**: Vibrant cyan (`oklch(0.68 0.15 210)`) for CTAs, active states, and drawing attention to key metrics
- **Foreground/Background Pairings**: 
  - Background (Light) `oklch(0.98 0.005 240)`: Foreground Dark `oklch(0.20 0.01 240)` - Ratio 15.2:1 ✓
  - Primary (Deep Blue) `oklch(0.35 0.12 250)`: White `oklch(1 0 0)` - Ratio 9.8:1 ✓
  - Accent (Cyan) `oklch(0.68 0.15 210)`: Dark `oklch(0.20 0.01 240)` - Ratio 8.6:1 ✓
  - Card (Light Blue-Gray) `oklch(0.92 0.01 240)`: Foreground Dark - Ratio 12.4:1 ✓

## Font Selection

Typography should feel modern, technical, and highly readable given the data-dense nature of the application. Using Space Grotesk for its geometric precision in headings and JetBrains Mono for code-related content creates a balanced technical aesthetic.

- **Typographic Hierarchy**: 
  - H1 (Page Titles): Space Grotesk Bold / 32px / -0.02em letter spacing
  - H2 (Section Headers): Space Grotesk SemiBold / 24px / -0.01em letter spacing
  - H3 (Card Titles): Space Grotesk Medium / 18px / normal letter spacing
  - Body (Metrics/Content): Inter Regular / 14px / normal letter spacing / 1.5 line height
  - Labels (Small Text): Inter Medium / 12px / 0.01em letter spacing / uppercase
  - Code/Numbers (Stats): JetBrains Mono Regular / 14-20px / tabular-nums

## Animations

Animations should reinforce the sense of real-time data updates and smooth transitions between views. Use subtle easing and purposeful motion.

- Chart data should animate in with a gentle ease-out when first loaded or when filters change (400ms)
- Metric cards should have a subtle scale and shadow increase on hover (150ms ease-out)
- View transitions should slide content with a 300ms ease-in-out to maintain spatial awareness
- Loading states should use a shimmer effect rather than spinners to maintain layout stability
- Number counters should animate up/down when values change with a spring physics feel

## Component Selection

- **Components**: 
  - Tabs (shadcn) for main navigation between Team / Individual / Repositories views
  - Card (shadcn) for metric containers with custom shadow and border treatments
  - Select (shadcn) for developer selection dropdowns
  - Calendar (shadcn) + Popover for date range selection
  - Table (shadcn) for repository listing with sortable columns
  - Avatar (shadcn) for developer profile images
  - Badge (shadcn) for status indicators and tags
  - Tooltip (shadcn) for showing detailed metric explanations on hover
  - Progress (shadcn) for showing relative performance metrics
  - Skeleton (shadcn) for loading states

- **Customizations**: 
  - Custom chart components using D3 for area charts, bar charts, and donut charts
  - Custom metric cards with animated number counters
  - Custom comparison grid layout for developer side-by-side views
  - Custom repository health indicator with color-coded visual

- **States**: 
  - Buttons: Default has solid accent background, hover lifts with shadow, active depresses slightly, disabled grays out at 40% opacity
  - Cards: Default has subtle shadow, hover elevates with increased shadow, active state shows accent border
  - Inputs/Selects: Focus shows accent ring, error state shows destructive border, success shows green accent
  
- **Icon Selection**: 
  - GitBranch for repository references
  - Code for commit-related metrics
  - Users for team/group views
  - User for individual profiles
  - TrendingUp/TrendingDown for performance trends
  - Calendar for date selection
  - ArrowsLeftRight for comparison mode
  - ChartBar for analytics sections
  
- **Spacing**: 
  - Page padding: p-6 (24px) on desktop, p-4 (16px) on mobile
  - Card padding: p-6 for content-heavy cards, p-4 for compact cards
  - Section gaps: gap-6 between major sections, gap-4 within sections
  - Grid gaps: gap-4 for card grids

- **Mobile**: 
  - Tabs scroll horizontally on mobile with snap-scroll behavior
  - Cards stack vertically on mobile instead of grid layout
  - Charts resize to full width with adjusted aspect ratios
  - Comparison mode switches from side-by-side to vertical stacking
  - Date picker expands to full screen on mobile for easier selection
  - Table switches to card-based layout showing key columns only
