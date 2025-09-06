FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for development)
RUN npm ci

# Copy source code
COPY . .

# Start the application
RUN ["npm", "run", "build"]

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
