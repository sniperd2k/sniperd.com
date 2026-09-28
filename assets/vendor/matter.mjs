/**
 * Re-export Matter.js from globalThis (set by script tag or vitest setup).
 * Do NOT import node:module here — this file is also loaded by the browser.
 */
const Matter = globalThis.Matter;
if (!Matter) {
  throw new Error(
    'Matter.js not loaded. Browser: include <script src="assets/vendor/matter.min.js"></script>. Tests: tests/setup-matter.js'
  );
}
export default Matter;
export const Engine = Matter.Engine;
export const World = Matter.World;
export const Bodies = Matter.Bodies;
export const Body = Matter.Body;
export const Composite = Matter.Composite;
export const Constraint = Matter.Constraint;
export const Events = Matter.Events;
export const Vector = Matter.Vector;
export const Query = Matter.Query;
