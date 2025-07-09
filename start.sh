#!/bin/bash

# vLLM Manager Start Script

echo "🚀 Starting vLLM Manager..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker compose > /dev/null 2>&1; then
    echo "❌ Docker Compose v2 is not available. Please install Docker Compose v2."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
fi

# Create data directory
mkdir -p server/data

# Function to start in development mode
dev_mode() {
    echo "🛠️  Starting in development mode..."
    
    # Check if dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm run install:all
    fi
    
    # Start backend in background
    echo "🔧 Starting backend server..."
    npm run dev &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 3
    
    # Start frontend
    echo "🎨 Starting frontend server..."
    npm run dev:frontend &
    FRONTEND_PID=$!
    
    # Wait for user to stop
    echo "✅ Development servers started!"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔧 Backend: http://localhost:3001"
    echo "Press Ctrl+C to stop all servers"
    
    # Cleanup on exit
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
    wait
}

# Function to start in production mode
prod_mode() {
    echo "🏭 Starting in production mode..."
    
    # Build and start with Docker Compose
    docker compose up -d --build
    
    if [ $? -eq 0 ]; then
        echo "✅ vLLM Manager started successfully!"
        echo "🌐 Access the application at: http://localhost:3001"
        echo "📊 View logs with: docker compose logs -f vllm-manager"
        echo "🛑 Stop with: docker compose down"
    else
        echo "❌ Failed to start vLLM Manager"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo "Start vLLM Manager in development or production mode"
    echo ""
    echo "Options:"
    echo "  dev, -d     Start in development mode"
    echo "  prod, -p    Start in production mode with Docker"
    echo "  help, -h    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev      # Start development servers"
    echo "  $0 prod     # Start production with Docker"
}

# Parse command line arguments
case "${1:-prod}" in
    dev|-d)
        dev_mode
        ;;
    prod|-p)
        prod_mode
        ;;
    help|-h)
        show_help
        ;;
    *)
        echo "❌ Unknown option: $1"
        show_help
        exit 1
        ;;
esac 