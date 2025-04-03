#!/bin/bash

APP_NAME="server"
pm2 start npm --name "$APP_NAME" -- run start

echo "?? Guardando configuraci�n para reinicio autom�tico"
pm2 save

echo "?? Haciendo que pm2 arranque con el sistema"
pm2 startup

echo "?? Copia y ejecuta el siguiente comando que aparecer� arriba si pm2 te lo pide (es necesario solo una vez)."

echo "?? Todo listo. Puedes usar 'pm2 list' para ver el estado de tu app."
