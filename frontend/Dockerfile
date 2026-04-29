FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files
COPY index.html /usr/share/nginx/html/
COPY index.css  /usr/share/nginx/html/
COPY app.js     /usr/share/nginx/html/

EXPOSE 80
