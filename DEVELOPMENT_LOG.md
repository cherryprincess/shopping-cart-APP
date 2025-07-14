# Shopping Cart Application Development Log

## Project Overview
This document captures the complete development process for creating a shopping cart web application with React, Vite, Docker, and Azure deployment pipeline.

**Repository**: shopping-cart-APP  
**Owner**: cherryprincess  
**Date**: July 14, 2025  

---

## Development Session Summary

### 1. Initial Request
**User Prompt**: "create a shopping cart application"

**Response & Actions**:
- Created a new Vite + React workspace
- Set up project structure with modern tooling
- Scaffolded basic shopping cart functionality

### 2. Project Setup
**User Prompt**: "Continue with #new workspace setup"

**Actions Taken**:
- Used `npx create-vite@latest . --template react`
- Installed dependencies with `npm install`
- Created project structure:
  ```
  ├── .github/
  │   ├── copilot-instructions.md
  │   └── workflows/ci.yml
  ├── .vscode/tasks.json
  ├── src/
  │   ├── App.jsx
  │   ├── Cart.jsx
  │   ├── ProductList.jsx
  │   └── products.js
  ├── Dockerfile
  ├── aks-deployment.yaml
  └── README.md
  ```

### 3. Core Application Files Created

#### App.jsx
```jsx
import { useState } from "react";
import "./App.css";
import { products } from "./products";
import ProductList from "./ProductList";
import Cart from "./Cart";

function App() {
  const [cart, setCart] = useState([]);

  const addToCart = (product) => {
    setCart((prevCart) => {
      const found = prevCart.find((item) => item.id === product.id);
      if (found) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  return (
    <div className="container">
      <h1>🛒 Shopping Cart App v2.0</h1>
      <p>Welcome to our modern shopping experience! Browse products and add them to your cart.</p>
      <ProductList products={products} addToCart={addToCart} />
      <Cart cart={cart} removeFromCart={removeFromCart} />
    </div>
  );
}

export default App;
```

#### ProductList.jsx
```jsx
import React from "react";

export default function ProductList({ products, addToCart }) {
  return (
    <div className="product-list">
      {products.map((product) => (
        <div className="product" key={product.id}>
          <img src={product.image} alt={product.name} width={120} height={120} />
          <h3>{product.name}</h3>
          <p>${product.price}</p>
          <button onClick={() => addToCart(product)}>Add to Cart</button>
        </div>
      ))}
    </div>
  );
}
```

#### Cart.jsx
```jsx
import React from "react";

export default function Cart({ cart, removeFromCart }) {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <div className="cart">
      <h2>Shopping Cart</h2>
      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              {item.name} x {item.quantity} (${item.price * item.quantity})
              <button onClick={() => removeFromCart(item.id)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <h3>Total: ${total}</h3>
    </div>
  );
}
```

### 4. DevOps Pipeline Development

#### User Request: Docker & Security Scanning
**User Prompt**: "add the dockerfile and also add trivy scan for image scan , it shouldn't be vulnerable"

**Response**:
- Created production-ready Dockerfile with multi-stage build
- Added Trivy vulnerability scanning to CI pipeline
- Configured to fail on CRITICAL/HIGH vulnerabilities

#### Dockerfile
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### User Request: Azure Container Registry & AKS Deployment
**User Prompts**:
- "can you modify now the pipeline code now to push the code to acr and also add a deployment file to pull image from acr and deploy to aks cluster ; use the build id tag"
- "can you split workflow to two stages for build and deploy"

**Response**:
- Split CI/CD pipeline into build and deploy stages
- Added ACR integration and image pushing
- Created Kubernetes deployment manifests
- Added AKS deployment with namespace support

#### Final CI/CD Pipeline (.github/workflows/ci.yml)
```yaml
name: CI Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      build_id: ${{ steps.build_tag.outputs.BUILD_ID }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm install
      - name: Build project
        run: npm run build
      - name: Build Docker image
        run: docker build -t shopping-cart-app .
      - name: Install Trivy
        run: |
          sudo apt-get update && \
          sudo apt-get install -y wget apt-transport-https gnupg lsb-release && \
          wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add - && \
          echo deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main | sudo tee -a /etc/apt/sources.list.d/trivy.list && \
          sudo apt-get update && \
          sudo apt-get install -y trivy
      - name: Scan Docker image for vulnerabilities
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: shopping-cart-app
          format: table
          exit-code: 1
          ignore-unfixed: true
          severity: CRITICAL,HIGH
      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: ${{ secrets.ACR_LOGIN_SERVER }}
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      - name: Set build tag
        id: build_tag
        run: echo "BUILD_ID=$(echo $GITHUB_RUN_NUMBER)" >> $GITHUB_ENV && echo "BUILD_ID=$GITHUB_RUN_NUMBER" >> $GITHUB_OUTPUT
      - name: Tag Docker image
        run: docker tag shopping-cart-app ${{ secrets.ACR_LOGIN_SERVER }}/shopping-cart-app:${{ env.BUILD_ID }}
      - name: Push Docker image to ACR
        run: docker push ${{ secrets.ACR_LOGIN_SERVER }}/shopping-cart-app:${{ env.BUILD_ID }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'latest'
      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      - name: Set AKS context
        uses: azure/aks-set-context@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
          cluster-name: ${{ secrets.AKS_CLUSTER_NAME }}
          resource-group: ${{ secrets.AKS_RESOURCE_GROUP }}
      - name: Create namespace if not exists
        run: kubectl create namespace ${{ secrets.AKS_NAMESPACE }} --dry-run=client -o yaml | kubectl apply -f -
      - name: Set image tag in deployment file
        run: |
          sed -i "s|<ACR_LOGIN_SERVER>/shopping-cart-app:BUILD_ID|${{ secrets.ACR_LOGIN_SERVER }}/shopping-cart-app:${{ needs.build.outputs.build_id }}|g" aks-deployment.yaml
      - name: Enable ACR integration with AKS
        run: |
          ACR_NAME=$(echo ${{ secrets.ACR_LOGIN_SERVER }} | cut -d'.' -f1)
          az aks update -n ${{ secrets.AKS_CLUSTER_NAME }} -g ${{ secrets.AKS_RESOURCE_GROUP }} --attach-acr $ACR_NAME
      - name: Create ACR secret for image pull
        run: |
          kubectl create secret docker-registry acr-secret \
            --docker-server=${{ secrets.ACR_LOGIN_SERVER }} \
            --docker-username=${{ secrets.ACR_USERNAME }} \
            --docker-password=${{ secrets.ACR_PASSWORD }} \
            --namespace=${{ secrets.AKS_NAMESPACE }} \
            --dry-run=client -o yaml | kubectl apply -f -
      - name: Deploy to AKS
        run: kubectl apply -f aks-deployment.yaml -n ${{ secrets.AKS_NAMESPACE }}
      - name: Verify deployment status
        run: |
          echo "Waiting for deployment to be ready..."
          kubectl rollout status deployment/shopping-cart-app -n ${{ secrets.AKS_NAMESPACE }} --timeout=300s
          echo "Checking pod status..."
          kubectl get pods -n ${{ secrets.AKS_NAMESPACE }} -l app=shopping-cart-app
          echo "Checking service status..."
          kubectl get svc -n ${{ secrets.AKS_NAMESPACE }} shopping-cart-app
```

### 5. Codespaces Configuration
**User Prompt**: "now till build is successful , can you deploy the application to codespaces"

**Response**:
- Created `.devcontainer/devcontainer.json` for GitHub Codespaces
- Configured automatic dependency installation and dev server startup
- Set up port forwarding for development

#### .devcontainer/devcontainer.json
```json
{
  "name": "Vite React Shopping Cart",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "forwardPorts": [5173],
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "settings": {},
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
      ]
    }
  },
  "portsAttributes": {
    "5173": {
      "label": "Vite Dev Server",
      "onAutoForward": "openBrowser"
    }
  },
  "postStartCommand": "npm run dev"
}
```

### 6. Azure Secrets Configuration
**User Prompt**: "secrets.AZURE_CREDENTIALS ; can you explain how to add ?"

**Response**: Provided detailed instructions for setting up Azure Service Principal and GitHub secrets:

#### Required GitHub Secrets:
- `AZURE_CREDENTIALS`: Service principal JSON
- `ACR_LOGIN_SERVER`: Azure Container Registry URL
- `ACR_USERNAME`: ACR username
- `ACR_PASSWORD`: ACR password
- `AKS_CLUSTER_NAME`: AKS cluster name
- `AKS_RESOURCE_GROUP`: Azure resource group
- `AKS_NAMESPACE`: Target Kubernetes namespace

#### Azure CLI Commands:
```bash
az ad sp create-for-rbac --name "github-actions-sp" --role contributor --scopes /subscriptions/{subscription-id} --sdk-auth
```

### 7. Troubleshooting & Fixes

#### Issue 1: Namespace Mismatch
**Problem**: Deployment failed due to hardcoded namespace in YAML
**Solution**: Removed hardcoded `namespace: default` from deployment manifests

#### Issue 2: ACR Authentication Failure
**Problem**: 401 Unauthorized when pulling images from ACR
**Solutions**:
1. Added ACR integration with AKS cluster
2. Created image pull secrets as backup
3. Updated deployment to use `imagePullSecrets`

#### Issue 3: ACR Resource Not Found
**Problem**: ACR attach command failed with resource not found
**Solution**: Extracted registry name from login server URL:
```bash
ACR_NAME=$(echo ${{ secrets.ACR_LOGIN_SERVER }} | cut -d'.' -f1)
```

### 8. Application Updates
**User Prompt**: "modify the index page content to rerun the application"

**Response**: Updated application with v2.0 branding and enhanced UI:
- Changed title to "Shopping Cart App - v2.0"
- Added shopping cart emoji and welcome message
- Enhanced meta description for SEO

### 9. Service Configuration
**User Prompt**: "also modify the service type from load balancer to clusterip"

**Response**: Changed Kubernetes service from LoadBalancer to ClusterIP for internal-only access

---

## Key Features Implemented

### Frontend Features:
- ✅ Product listing with images and prices
- ✅ Add to cart functionality
- ✅ Cart management (add/remove items)
- ✅ Quantity tracking
- ✅ Total price calculation
- ✅ Responsive design with modern CSS

### DevOps Features:
- ✅ Docker containerization with multi-stage builds
- ✅ Security scanning with Trivy
- ✅ Azure Container Registry integration
- ✅ Azure Kubernetes Service deployment
- ✅ GitHub Actions CI/CD pipeline
- ✅ Automated deployment verification
- ✅ Namespace management
- ✅ Image pull secret configuration

### Development Features:
- ✅ GitHub Codespaces support
- ✅ VS Code tasks configuration
- ✅ Hot reload development server
- ✅ ESLint and Prettier integration

---

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Repo   │    │  GitHub Actions │    │   Azure ACR     │
│                 │───▶│                 │───▶│                 │
│ - Source Code   │    │ - Build & Test  │    │ - Docker Images │
│ - Workflows     │    │ - Security Scan │    │ - Image Storage │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Azure AKS     │
                       │                 │
                       │ - Kubernetes    │
                       │ - Load Balancer │
                       │ - Auto Scaling  │
                       └─────────────────┘
```

---

## Next Steps & Recommendations

1. **Add Database**: Consider adding a backend API with database for persistent cart storage
2. **Authentication**: Implement user authentication and personal cart management
3. **Payment Integration**: Add payment processing capabilities
4. **Monitoring**: Set up application monitoring and logging
5. **Testing**: Add unit tests and integration tests
6. **Performance**: Implement caching and performance optimizations

---

## Commands Reference

### Development
```bash
npm install          # Install dependencies
npm run dev         # Start development server
npm run build       # Build for production
```

### Docker
```bash
docker build -t shopping-cart-app .
docker run -p 80:80 shopping-cart-app
```

### Kubernetes
```bash
kubectl apply -f aks-deployment.yaml -n <namespace>
kubectl get pods -n <namespace>
kubectl rollout status deployment/shopping-cart-app -n <namespace>
```

---

*Generated on: July 14, 2025*  
*Project: shopping-cart-APP*  
*Owner: cherryprincess*
