Real-Time Data Analytics Platform
This is a full-stack web application I built to help analyze large CSV files. The main goal was to create a tool that could process datasets with millions of rows and quickly show useful analytics and charts without crashing or slowing down.

It uses a Node.js backend to do the heavy lifting in the background and a React frontend to display the results in a clean, interactive dashboard.

Key Architectural Features
Non-Blocking Backend: Utilizes Node.js worker threads to offload heavy CSV processing, ensuring the main server remains responsive.

Memory Efficient: Employs streaming APIs to analyze files piece-by-piece, allowing it to handle datasets far larger than available RAM.

Real-Time UI: Uses WebSockets to push completed analytics from the server to the React frontend for an instantaneous user experience.

Note: This project is currently under active development. The code is available for review, but a stable, runnable version is coming soon.
