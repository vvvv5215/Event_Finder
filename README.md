# EventFinderPro

A modern web application for discovering and managing local events. Built with React, Node.js, and PostgreSQL.

## Features

- 🔍 Search and filter events by category, date, and location
- 🗺️ Interactive map view for event locations
- 👥 User authentication and profiles
- 📱 Responsive design for mobile and desktop
- 🎨 Modern UI with Tailwind CSS
- 🔄 Real-time updates with WebSocket

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Authentication**: Passport.js
- **Maps**: Leaflet
- **State Management**: React Query
- **Styling**: Tailwind CSS, Shadcn UI

## Prerequisites

- Node.js (v20 or higher)
- PostgreSQL (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/vvvv5215/Event_Finder.git
cd Event_Finder
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventfinder
NODE_ENV=development
PORT=3000
```

4. Set up the database:
- Create a PostgreSQL database named 'eventfinder'
- Run migrations:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
EventFinderPro/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utility functions
├── server/                # Backend Node.js application
│   ├── routes/           # API routes
│   ├── db/               # Database configuration
│   └── storage/          # Data storage layer
├── shared/               # Shared types and utilities
└── drizzle/             # Database migrations
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Shadcn UI](https://ui.shadcn.com/) for the beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for the styling system
- [Drizzle ORM](https://orm.drizzle.team/) for the database ORM
