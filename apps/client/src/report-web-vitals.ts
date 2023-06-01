import { onLCP, onFID, onCLS, onTTFB } from "web-vitals";
const options = { reportAllChanges: true };

function reportWebVitals() {
  onCLS(console.log, options);
  onFID(console.log, options);
  onLCP(console.log, options);
  onTTFB(console.log, options);
}

export { reportWebVitals };
