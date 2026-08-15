import './style.css';
import { initializeApp } from "firebase/app";

// Firebase Initialization
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyForNow",
  authDomain: "gdg-srmcem-dummy.firebaseapp.com",
  projectId: "gdg-srmcem-dummy",
  storageBucket: "gdg-srmcem-dummy.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
const app = initializeApp(firebaseConfig);

// Advanced JS Parallax Engine
document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll('.scroll-section');
  
  // Elements to animate
  const introShape1 = document.getElementById('intro-shape1');
  const introShape2 = document.getElementById('intro-shape2');
  const introText = document.getElementById('intro-text');
  
  const scaleVisual = document.getElementById('scale-visual');
  const scaleText = document.getElementById('scale-text');
  
  const srmcemImage = document.getElementById('srmcem-image');
  const srmcemText = document.getElementById('srmcem-text');
  
  const eventsVisual = document.getElementById('events-visual');
  const eventsText = document.getElementById('events-text');

  const expectGrid = document.getElementById('expect-grid');
  const teamVisual = document.getElementById('team-visual');

  let ticking = false;

  function updateParallax() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;

    sections.forEach((section, index) => {
      const rect = section.getBoundingClientRect();
      // Calculate progress of this section from 0 to 1 (when it hits top to when it leaves top)
      const sectionTop = rect.top; 
      
      // We only care when the section is pinned (top <= 0) and hasn't completely scrolled out
      if (sectionTop <= 0 && sectionTop > -rect.height) {
        // Progress from 0 (just pinned) to 1 (about to unpin)
        // Since height is 200vh, the scrollable distance while pinned is 100vh
        const scrollDistance = rect.height - windowHeight;
        let progress = Math.abs(sectionTop) / scrollDistance;
        // Clamp between 0 and 1
        progress = Math.max(0, Math.min(1, progress));

        // Apply animations based on section index
        switch(section.id) {
          case 'sec-intro':
            // Shapes move outward and fade, text moves up
            if (introShape1) introShape1.style.transform = `translate(${progress * -100}px, ${progress * -100}px) scale(${1 + progress})`;
            if (introShape2) introShape2.style.transform = `translate(${progress * 100}px, ${progress * 100}px) scale(${1 + progress})`;
            if (introText) {
              introText.style.transform = `translateY(${progress * -100}px)`;
              introText.style.opacity = 1 - (progress * 1.5);
            }
            break;
            
          case 'sec-scale':
            // Slide in from right and left
            if (scaleText) {
              scaleText.style.transform = `translateX(${(1 - progress) * -100}px)`;
              scaleText.style.opacity = progress * 2;
            }
            if (scaleVisual) {
              scaleVisual.style.transform = `translateX(${(1 - progress) * 100}px) scale(${0.8 + (progress * 0.2)})`;
              scaleVisual.style.opacity = progress * 2;
            }
            break;

          case 'sec-srmcem':
            // Image scales up, text fades in
            if (srmcemImage) {
               srmcemImage.style.transform = `scale(${0.5 + (progress * 0.5)})`;
               srmcemImage.style.opacity = progress * 1.5;
            }
            if (srmcemText) {
               srmcemText.style.transform = `translateY(${(1-progress) * 50}px)`;
               srmcemText.style.opacity = progress * 2;
            }
            break;
            
          case 'sec-events':
            if (eventsVisual) {
               eventsVisual.style.transform = `translateY(${(1-progress) * 100}px)`;
               eventsVisual.style.opacity = progress * 2;
            }
            if (eventsText) {
               eventsText.style.transform = `translateX(${(1-progress) * -50}px)`;
               eventsText.style.opacity = progress * 2;
            }
            break;
            
          case 'sec-expect':
            if (expectGrid) {
               expectGrid.style.transform = `scale(${0.9 + (progress * 0.1)})`;
               expectGrid.style.opacity = progress * 2;
            }
            break;
            
          case 'sec-team':
            if (teamVisual) {
               teamVisual.style.transform = `translateY(${(1-progress) * 50}px)`;
               teamVisual.style.opacity = progress * 2;
            }
            break;
        }
      }
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  });
  
  // Initial call
  updateParallax();
});
