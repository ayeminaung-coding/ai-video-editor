# AI Video Editor

AI-powered video editing web app for TikTok. Create, edit, and export videos with AI assistance.

## Features

- **AI Video Editing**: Smart video editing with AI-powered tools
- **TikTok Optimization**: Optimized for TikTok format and requirements
- **Real-time Preview**: See changes instantly as you edit
- **Export Options**: Export in multiple formats and qualities
- **Free to Use**: Completely free, no paid services required

## Tech Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **React Router** - Routing

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Python** - AI services
- **Hugging Face** - AI models

### Database & Storage
- **Supabase/Neon** - PostgreSQL database
- **Cloudinary** - Video storage
- **Vercel/Netlify** - Hosting

## Project Structure

```
ai-video-editor/
├── src/
│   ├── components/          # React components
│   │   ├── ControlPanel.tsx
│   │   ├── VideoPreview.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── ThemeSelector.tsx
│   │   └── ...
│   ├── contexts/            # React contexts
│   │   └── ThemeContext.tsx
│   ├── pages/               # Page components
│   │   ├── UploadPage.tsx
│   │   ├── EditorPage.tsx
│   │   ├── PreviewPage.tsx
│   │   └── DashboardPage.tsx
│   ├── styles/              # Global styles
│   │   └── globals.css
│   ├── utils/               # Utility functions
│   ├── hooks/               # Custom hooks
│   └── main.tsx             # Entry point
├── public/                  # Static assets
│   ├── icons/               # SVG icons
│   ├── images/              # Images
│   └── fonts/               # Fonts
├── backend/                 # Backend code
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Middleware
│   │   ├── services/        # Business logic
│   │   └── models/          # Data models
│   └── package.json
├── ai/                      # AI services
│   ├── models/              # AI models
│   └── services/            # AI services
├── docs/                    # Documentation
│   ├── assets.md            # Assets documentation
│   ├── dark-mode.md         # Dark mode documentation
│   ├── design-system.md     # Design system
│   ├── components.md        # Components documentation
│   ├── pages.md             # Pages documentation
│   └── responsive-design.md # Responsive design
├── .env                     # Environment variables
├── .env.example             # Example environment variables
├── .gitignore               # Git ignore file
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── tailwind.config.js       # Tailwind config
├── vite.config.ts           # Vite config
├── index.html               # Main HTML
└── README.md                # This file
```

## Installation

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+ or yarn/pnpm
- Git

### Clone Repository
```bash
git clone https://github.com/your-username/ai-video-editor.git
cd ai-video-editor
```

### Install Dependencies
```bash
npm install
```

### Environment Variables
Create a `.env` file in the root directory:

```env
# Frontend
VITE_API_URL=http://localhost:3001
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset

# Backend
PORT=3001
DATABASE_URL=your_database_url
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
HUGGING_FACE_API_KEY=your_hugging_face_api_key
```

## Development

### Start Development Server
```bash
npm run dev
```

This will start the Vite development server on `http://localhost:3000`.

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Run Tests
```bash
npm run test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Lint Code
```bash
npm run lint
```

### Format Code
```bash
npm run format
```

## Deployment

### Deploy to Vercel

1. **Create GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/ai-video-editor.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project settings

3. **Configure Environment Variables**
   - Go to Project Settings > Environment Variables
   - Add all required environment variables
   - Click "Save"

4. **Deploy**
   - Vercel will automatically deploy when you push to main
   - You can also deploy manually from the Vercel dashboard

### Deploy to Netlify

1. **Create GitHub Repository** (same as above)

2. **Connect to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub
   - Click "Add new site" > "Import an existing project"
   - Connect your GitHub repository
   - Configure build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`

3. **Configure Environment Variables**
   - Go to Site Settings > Build & Deploy > Environment
   - Add all required environment variables
   - Click "Save"

4. **Deploy**
   - Netlify will automatically deploy when you push to main
   - You can also deploy manually from the Netlify dashboard

## API Endpoints

### Frontend API
```
GET    /api/videos          - Get all videos
POST   /api/videos          - Upload new video
GET    /api/videos/:id      - Get video by ID
PUT    /api/videos/:id      - Update video
DELETE /api/videos/:id      - Delete video
POST   /api/videos/:id/edit - Apply edits to video
POST   /api/videos/:id/export - Export video
```

### AI API
```
POST   /api/ai/trim         - AI trim suggestion
POST   /api/ai/speed        - AI speed adjustment
POST   /api/ai/overlay      - AI text overlay
POST   /api/ai/music        - AI music recommendation
POST   /api/ai/export       - AI export optimization
```

## Features in Detail

### Video Upload
- Drag and drop interface
- Multiple file format support
- Progress indicator
- File validation

### Video Editing
- **Trim**: Cut start and end of video
- **Speed**: Adjust playback speed (0.5x - 3x)
- **Volume**: Control audio volume
- **Brightness**: Adjust brightness
- **Contrast**: Adjust contrast
- **Text Overlay**: Add text to video
- **Music**: Add background music

### AI Features
- **Smart Trim**: AI suggests optimal trim points
- **Auto Speed**: AI adjusts speed based on content
- **Text Suggestions**: AI suggests text overlays
- **Music Match**: AI recommends music based on mood
- **Export Optimization**: AI optimizes export settings

### Export Options
- **Quality**: 480p, 720p, 1080p
- **Format**: MP4, WebM
- **Aspect Ratio**: 9:16 (TikTok), 1:1, 16:9
- **Frame Rate**: 30fps, 60fps

## Design System

### Colors
- **Primary**: Indigo (#6366f1)
- **Secondary**: Purple (#8b5cf6)
- **Success**: Green (#10b981)
- **Error**: Red (#ef4444)
- **Warning**: Yellow (#f59e0b)

### Typography
- **Font**: Inter (Google Fonts)
- **Code Font**: JetBrains Mono
- **Base Size**: 16px
- **Scale**: 1.25 (Major Third)

### Spacing
- **Base**: 4px
- **Scale**: 1.25 (Major Third)
- **Max**: 120px

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## Testing

### Unit Tests
```bash
npm run test
```

### Component Tests
```bash
npm run test:components
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details

## Support

- **Documentation**: See `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/your-username/ai-video-editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/ai-video-editor/discussions)

## Roadmap

### Phase 1: Frontend (Current)
- [x] Design system
- [x] Components
- [x] Pages
- [ ] Dark mode
- [ ] Responsive design
- [ ] Testing

### Phase 2: Backend
- [ ] API endpoints
- [ ] Database setup
- [ ] Authentication
- [ ] File upload

### Phase 3: AI Integration
- [ ] Hugging Face integration
- [ ] AI video editing
- [ ] Smart suggestions
- [ ] Export optimization

### Phase 4: Deployment
- [ ] Vercel deployment
- [ ] Netlify deployment
- [ ] Custom domain
- [ ] SSL certificate

## Acknowledgments

- **React** - UI framework
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Hugging Face** - AI models
- **Cloudinary** - Video storage
- **Vercel** - Hosting

## Contact

- **Project**: [GitHub Repository](https://github.com/your-username/ai-video-editor)
- **Issues**: [GitHub Issues](https://github.com/your-username/ai-video-editor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/ai-video-editor/discussions)

---

**Made with ❤️ for TikTok creators**