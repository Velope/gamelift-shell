#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
#
#!/bin/bash
# ========================================================================
# Installation Guide:
# ========================================================================
# First time setup:
#   1. Open terminal in the project directory
#   2. Make script executable:
#      chmod +x install.sh
#
#   3. If you created/edited this file on Windows:
#      dos2unix install.sh
#
#   4. Run the script:
#      ./install.sh
#
# Subsequent runs:
#   Just run:
#   ./install.sh
#
# Common Issues:
#   - "Permission denied" -> Run: chmod +x install.sh
#   - "Bad interpreter" -> Run: dos2unix install.sh
#   - Script fails -> Check if Node.js is installed
#
# Supported Platforms:
#   - macOS
#   - Linux
#   - Windows Subsystem for Linux (WSL)
# ========================================================================

# Detect operating system and environment
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "Running on macOS"
    # Add any macOS-specific configurations here
elif grep -q Microsoft /proc/version 2>/dev/null; then
    # WSL (Windows Subsystem for Linux)
    echo "Running on Windows Subsystem for Linux (WSL)"
    # Add any WSL-specific configurations here
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    echo "Running on Linux"
    # Add any Linux-specific configurations here
else
    echo "Unsupported operating system"
    echo "This script supports macOS, Linux, and Windows Subsystem for Linux (WSL)"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed or not in the system PATH."
    echo "Please install Node.js from https://nodejs.org/ and try again."
    exit 1
fi

echo "Starting local server..."

# Install root dependencies
npm install
if [ $? -ne 0 ]; then
    echo "npm install failed in root. Please check your internet connection and try again."
    exit 1
fi

# Install @types/node
echo "Installing @types/node..."
npm install --save-dev @types/node
if [ $? -ne 0 ]; then
    echo "Failed to install @types/node"
    exit 1
fi

# Verify aws-cdk-lib installation
if ! npm list aws-cdk-lib > /dev/null 2>&1; then
    echo "aws-cdk-lib not found. Installing..."
    npm install aws-cdk-lib
    if [ $? -ne 0 ]; then
        echo "Failed to install aws-cdk-lib"
        exit 1
    fi
fi

# Navigate to server directory and install its dependencies
cd server
npm install --omit=dev
if [ $? -ne 0 ]; then
    echo "npm install failed in server folder. Please check your internet connection and try again."
    cd ..
    exit 1
fi

# Return to root directory
cd ..

# Set IS_LOCAL to true for local development
echo "Setting IS_LOCAL to true for local development..."
export IS_LOCAL=true
node build.js
if [ $? -ne 0 ]; then
    echo "Failed to set IS_LOCAL to true"
    exit 1
fi

# Set NODE_ENV and run build script
export NODE_ENV=development
node build.js

# Set AWS SDK related environment variables
export AWS_SDK_LOAD_CONFIG=1
export AWS_NODEJS_CONNECTION_REUSE_ENABLED=1
export AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

# Navigate to server directory and start server
cd server
export NODE_ENV=development

# Check AWS SDK installation (Unix version)
echo "Checking AWS SDK installation..."
if [ ! -d "node_modules/@aws-sdk" ]; then
    echo "AWS SDK not found. Running reinstall..."
    rm -rf node_modules package-lock.json
    npm install
    if [ $? -ne 0 ]; then
        echo "Reinstall failed. Please check your setup and try again."
        cd ..
        exit 1
    fi
else
    echo "AWS SDK found."
fi

# Start the server
echo "Starting the server..."
npm run start

# Return to root directory
cd ..
