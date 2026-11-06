import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[tailwindcss()],server:{proxy:{'/api':'http://localhost:3000','/socket.io':{target:'http://localhost:3000',ws:true}}}});
