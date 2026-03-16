#!/bin/sh
set -e

echo "Installing backend dependencies..."
npm install --prefix backend

echo "Installing frontend dependencies..."
npm install --prefix frontend

echo "Building frontend..."
npm run build --prefix frontend
