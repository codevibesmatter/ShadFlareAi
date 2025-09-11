-- Simple seed data for tasks table (without foreign key constraints)
-- Note: These tasks are associated with the demo user (pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP)

INSERT INTO "task" ("id", "userId", "title", "description", "status", "label", "priority", "assignee", "dueDate", "createdAt", "updatedAt") VALUES
('TASK-1001', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Setup Development Environment', 'Install and configure all necessary development tools and dependencies', 'done', 'feature', 'high', 'John Doe', NULL, 1725724800, 1726243200),
('TASK-1002', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Design Database Schema', 'Create comprehensive database schema for the application', 'done', 'feature', 'high', 'Jane Smith', NULL, 1725811200, 1726156800),
('TASK-1003', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Implement User Authentication', 'Set up Better Auth with OAuth providers (Google, GitHub)', 'in progress', 'feature', 'critical', 'John Doe', 1726502400, 1725897600, 1726243200),
('TASK-1004', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Create API Endpoints', 'Build REST API endpoints for CRUD operations', 'in progress', 'feature', 'high', 'Bob Wilson', 1726934400, 1725984000, 1726241400),
('TASK-1005', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Fix Login Bug', 'Users cannot login with special characters in password', 'todo', 'bug', 'high', 'Jane Smith', 1726416000, 1726070400, 1726070400),
('TASK-1006', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Write API Documentation', 'Create comprehensive API documentation using OpenAPI/Swagger', 'todo', 'documentation', 'medium', 'Alice Johnson', 1727020800, 1726156800, 1726156800),
('TASK-1007', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Implement Dark Mode', 'Add dark mode support across the application', 'todo', 'feature', 'low', 'Charlie Brown', 1727280000, 1726156800, 1726156800),
('TASK-1008', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Setup CI/CD Pipeline', 'Configure automated testing and deployment pipeline', 'backlog', 'feature', 'medium', NULL, NULL, 1726156800, 1726156800),
('TASK-1009', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Performance Optimization', 'Optimize application performance and loading times', 'backlog', 'feature', 'medium', NULL, NULL, 1726156800, 1726156800),
('TASK-1010', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Fix Mobile Responsiveness', 'Dashboard not displaying correctly on mobile devices', 'todo', 'bug', 'medium', 'Diana Prince', 1726675200, 1726221600, 1726221600),
('TASK-1011', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Add Data Export Feature', 'Allow users to export their data in CSV/JSON format', 'backlog', 'feature', 'low', NULL, NULL, 1726200000, 1726200000),
('TASK-1012', 'pWCD43Y7W24ZwHXNZOnbfeocUXtlE5gP', 'Security Audit', 'Conduct comprehensive security audit of the application', 'canceled', 'feature', 'critical', 'Frank Castle', NULL, 1725379200, 1725552000);