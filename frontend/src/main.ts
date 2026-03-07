import { App } from "./App";
import "./styles/main.css";

declare const __APP_NAME__: string;
declare const __APP_VERSION__: string;

const app = new App(document.getElementById("app")!);
app.init();

console.log(`${__APP_NAME__} v${__APP_VERSION__} initialized`);
