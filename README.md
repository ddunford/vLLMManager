# vLLM Manager

A comprehensive web application for managing vLLM (Virtual Large Language Model) instances with HuggingFace integration. This application allows you to easily deploy, manage, and monitor multiple vLLM instances through a modern web interface.

## Features

- 🚀 **Easy Instance Management**: Create, start, stop, restart, and remove vLLM instances
- 🔍 **HuggingFace Integration**: Search and browse models directly from HuggingFace
- 🔐 **Authentication Support**: Full support for gated and private models with API keys
- 📊 **Real-time Monitoring**: Live status updates and container logs
- 🌐 **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- 🐳 **Docker-based**: Containerized deployment for easy setup and scaling
- 📱 **Mobile Friendly**: Responsive design works on all devices

## Architecture

- **Frontend**: React.js with Tailwind CSS for styling
- **Backend**: Node.js with Express.js API
- **Database**: SQLite for instance configuration storage
- **Container Management**: Docker API integration for vLLM instances
- **Model Discovery**: HuggingFace API integration

## Quick Start

### Prerequisites

- Docker and Docker Compose v2
- Node.js 18+ (for development)
- At least 4GB RAM for running models

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vllm-manager
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development servers**
   ```bash
   # Terminal 1: Start backend
   npm run dev

   # Terminal 2: Start frontend
   npm run dev:frontend
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Production Deployment

1. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your production settings
   ```

2. **Build and start with Docker Compose**
   ```bash
   # For production
   docker compose -f docker-compose.prod.yml up -d
   
   # For development
   docker compose up -d
   ```

3. **Access the application**
   - Application: http://localhost:3001

For detailed production deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Manual Docker Build

```bash
# Build the image
docker build -t vllm-manager .

# Run the container
docker run -d \
  -p 3001:3001 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ./server/data:/app/server/data \
  --name vllm-manager \
  vllm-manager
```

## Usage

### Creating a New Instance

1. Navigate to the **Create Instance** page
2. Enter an instance name and model name (e.g., `microsoft/DialoGPT-medium`)
3. Optionally provide a HuggingFace API key for gated models
4. Click **Create Instance**

### Managing Instances

- **Dashboard**: View all instances with their status and basic controls
- **Instance Details**: Click on any instance to view logs, detailed information, and API usage examples
- **Actions**: Start, stop, restart, or remove instances directly from the dashboard

### Using the API

Once an instance is running, you can access the OpenAI-compatible API:

```bash
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer localkey" \
  -d '{
    "model": "your-model-name",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## API Endpoints

### Container Management

- `GET /api/containers` - List all instances
- `POST /api/containers` - Create new instance
- `POST /api/containers/:id/start` - Start instance
- `POST /api/containers/:id/stop` - Stop instance
- `POST /api/containers/:id/restart` - Restart instance
- `DELETE /api/containers/:id` - Remove instance
- `GET /api/containers/:id/logs` - Get container logs

### Model Discovery

- `GET /api/models/search?query=<query>` - Search HuggingFace models
- `GET /api/models/popular` - Get popular models
- `GET /api/models/:modelId` - Get model details
- `POST /api/models/validate` - Validate model access

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `HF_TOKEN` | HuggingFace API token | - |
| `MIN_PORT` | Minimum port for instances | `8001` |
| `MAX_PORT` | Maximum port for instances | `9000` |

### Model Selection

The application supports any HuggingFace model compatible with vLLM:

- **Text Generation**: GPT-style models, LLaMA, Mistral, etc.
- **Conversational**: ChatGPT-style models
- **Code Generation**: CodeLLaMA, CodeT5, etc.

### Resource Requirements

- **Minimum**: 4GB RAM, 2 CPU cores
- **Recommended**: 8GB+ RAM, 4+ CPU cores
- **Storage**: 10GB+ for model caching

## Troubleshooting

### Common Issues

1. **Port already in use**
   - The application automatically assigns available ports
   - Check if other services are using the port range (8001-9000)

2. **Model download fails**
   - Ensure internet connectivity
   - Check if the model requires authentication
   - Verify HuggingFace API key for gated models

3. **Container creation fails**
   - Ensure Docker daemon is running
   - Check Docker socket permissions
   - Verify available disk space

### Logs

- Application logs: `docker compose logs vllm-manager`
- Instance logs: Available through the web interface
- Container logs: `docker logs <container-name>`

## Development

### Project Structure

```
vllm-manager/
├── server/              # Backend API
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── middleware/     # Security and logging middleware
│   ├── database/       # Database management
│   └── tests/          # Backend tests
├── frontend/           # React frontend
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── pages/      # Page components
│   │   └── services/   # API clients
│   └── public/
├── .github/            # GitHub Actions CI/CD
├── docker-compose.yml  # Development Docker configuration
├── docker-compose.prod.yml # Production Docker configuration
└── Dockerfile         # Container build instructions
```

### Development Scripts

```bash
# Start development servers
npm run dev              # Backend with auto-reload
npm run dev:frontend     # Frontend development server

# Testing
npm test                 # Run backend tests
npm run test:coverage    # Run tests with coverage
npm run test:watch       # Watch mode for tests

# Code quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix linting issues
npm run format           # Format code with Prettier

# Docker
npm run docker:up        # Start development containers
npm run docker:down      # Stop containers
npm run docker:prod      # Start production containers
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and formatting: `npm run lint:fix && npm run format`
6. Ensure all tests pass: `npm test`
7. Submit a pull request

The project includes:
- ✅ **Automated Testing**: Jest test suite with coverage reporting
- ✅ **Code Quality**: ESLint and Prettier for consistent code style
- ✅ **CI/CD Pipeline**: GitHub Actions for automated testing and deployment
- ✅ **Security Scanning**: Automated vulnerability scanning in CI
- ✅ **Docker Support**: Multi-stage builds with security best practices

### Adding New Features

- Backend routes: Add to `server/routes/`
- Frontend pages: Add to `frontend/src/pages/`
- UI components: Add to `frontend/src/components/`
- API services: Add to `server/services/`

## Security Considerations

- ✅ **Production-Ready Security**: Comprehensive security middleware with Helmet.js
- ✅ **Rate Limiting**: Protection against DoS attacks and API abuse
- ✅ **Environment Variables**: All sensitive data configured via environment variables
- ✅ **Container Security**: Non-root user and security options enabled
- ✅ **Security Headers**: CORS, CSP, HSTS, and other security headers configured
- ✅ **Input Validation**: Server-side validation of all user inputs
- ✅ **Security Logging**: Monitoring and logging of suspicious activities
- ✅ **Container Isolation**: Docker networks and security options prevent interference
- ✅ **Regular Updates**: Automated dependency scanning and security updates

See [SECURITY.md](SECURITY.md) for detailed security documentation.

## Performance Tips

- Use smaller models for testing and development
- Monitor resource usage through the dashboard
- Scale horizontally by running multiple instances
- Use SSD storage for better model loading performance

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review container logs
- Open an issue on GitHub 