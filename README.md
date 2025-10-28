# BitHab - Project Structure

**⚠️NOTE: This is not my code - the owner of this project is my classmate [vishal-muralidharan](https://github.com/vishal-muralidharan). I only helped him connect this app to a Firebase database for authentication and deploy the project using netlify**

## Project Overview
BitHab is a habit tracking application with a clean, professional folder structure.

## Folder Structure

```
curr3/
├── index.html                 # Main dashboard page (root)
├── README.md                  # Project documentation
├── assets/                    # All static assets
│   ├── css/                   # Stylesheets
│   │   ├── style.css          # Main styles
│   │   ├── dashboard.css      # Dashboard-specific styles
│   │   ├── management.css     # Activities/Goals management styles
│   │   └── auth.css           # Authentication page styles
│   ├── js/                    # JavaScript files
│   │   ├── script.js          # Main dashboard script
│   │   ├── activities.js      # Activities management script
│   │   ├── goals.js           # Goals management script
│   │   └── theme-toggle.js    # Theme switching functionality
│   └── images/                # Image assets
│       ├── logo.png           # Main logo
│       ├── logo-transparent-light.png
│       └── logo-transparent-dark.png
├── pages/                     # HTML pages (except main dashboard)
│   ├── activities.html        # Activities management
│   ├── goals.html            # Goals management
│   ├── login.html            # Login page
│   └── register.html         # Registration page
└── config/                    # Configuration files 
    └── generate-firebase-config.js # Firebase configuration
```

## File Relationships

### Navigation Links
- **From root (index.html)**: Links to `pages/activities.html`, `pages/goals.html`
- **From pages/**: Links back to `../index.html` for dashboard

### Asset References
- **CSS**: All pages reference `../assets/css/` (from pages) or `assets/css/` (from root)
- **JS**: All pages reference `../assets/js/` (from pages) or `assets/js/` (from root)
- **Images**: All pages reference `../assets/images/` (from pages) or `assets/images/` (from root)
- **Config**: All pages reference `../config/` (from pages) or `config/` (from root)

## Benefits of This Structure

1. **Professional Organization**: Clean separation of concerns
2. **Maintainability**: Easy to locate and modify specific file types
3. **Scalability**: Easy to add new pages, styles, or scripts
4. **Performance**: Logical grouping for potential CDN deployment
5. **Version Control**: Better diff tracking with organized structure
6. **Deployment**: Clear asset management for build processes

## Development Notes

- Main dashboard stays at root for easy access
- All sub-pages are in `/pages/` folder
- All static assets are properly organized in `/assets/`
- Configuration files are isolated in `/config/`
- All file references use relative paths for portability
