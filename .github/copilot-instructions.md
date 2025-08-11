# GitHub Copilot Instructions for CAN Project

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview

This project implements a **Domain-mapped Content Addressable Network (CAN) Service** using AT Protocol as the backend blob store.  
The goal is to provide a simple, RESTful HTTP API for users to **upload, retrieve, and delete blobs** with **user-friendly keys** mapped to content hashes (CIDs) in their AT Protocol Personal Data Store (PDS).  

Optional versioning support allows storing multiple versions of blobs keyed by version IDs or timestamps.

## Key Concepts

- **Blobs**: Raw binary content stored in AT Protocol PDS, identified by immutable CIDs.  
- **Keys**: Human-readable strings (like filenames) mapped to CIDs via a custom AT Protocol lexicon record.  
- **Custom Lexicon**:  
  - Stores mapping records with properties: `key`, `current` blob info (`cid`, `mimeType`, `size`), and optional `versions` map for version history.  
- **API**: Provides endpoints for CRUD operations on blobs via keys, hiding AT Protocol complexity.  
- **Authentication**: Users authenticate with their AT Protocol handle and app password, passed with each request. The service acts on their behalf.  
- **Domain Mapping**: Service supports domain mapping via subdomains or user custom domains with CDN integration.

## Coding Style & Practices

- Use clear, descriptive variable and function names reflecting CAN and AT Protocol concepts.  
- Write idiomatic TypeScript using async/await for network calls.  
- Include JSDoc comments for public functions, especially API handlers and lexicon operations.  
- Handle errors gracefully, providing meaningful HTTP status codes and messages.  
- Keep the gateway stateless regarding user credentials; authenticate each request using passed credentials.  
- Use modular code: separate lexicon logic, AT Protocol client interactions, and HTTP API handlers.  
- Write tests covering lexicon mapping, versioning logic, and API endpoints.

## Versioning Implementation

- Versioning is optional and implemented as a **map/dictionary** keyed by version IDs or timestamps.  
- On blob update, archive previous `current` blob info into `versions` before replacing `current`.  
- Provide API endpoints to list versions and fetch specific versions by key.  
- Allow disabling versioning per user or blob.

## Security & Auth

- Accept user AT Protocol credentials (handle + app password) on every request (e.g., Basic Auth).  
- Do **not** store user credentials persistently; authenticate per request.  
- Validate inputs and sanitize keys to prevent injection attacks.  
- Use HTTPS and secure headers.

## Testing & Deployment

- Include unit and integration tests for lexicon CRUD, blob upload/download flows, and auth middleware.  
- Mock AT Protocol client calls in tests for isolation.  
- Use environment variables for configurable parameters like domain names and API keys.  
- Prepare for deployment behind CDN (e.g., Cloudflare) with support for custom domains.

## TypeScript Specific Guidelines

- Use strict TypeScript configuration with proper type definitions
- Define interfaces for AT Protocol records, API requests/responses, and configuration
- Use proper error handling with custom error classes
- Implement proper logging with structured data
- Use dependency injection for better testability
- Follow Express.js TypeScript best practices for route handlers and middleware
