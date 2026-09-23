FROM nginx:1.27-alpine

# Endereço interno da API (nome do serviço no docker-compose)
ENV API_URL=http://api:5000

# O Nginx substitui ${API_URL} no template ao iniciar o container
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js

EXPOSE 80
