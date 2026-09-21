(function () {
    'use strict';

    document.documentElement.classList.add('data-story-ready');

    window.toggleDataStoryMotion = function (button) {
        const paused = !document.body.classList.contains('motion-paused');
        document.body.classList.toggle('motion-paused', paused);
        button.setAttribute('aria-pressed', String(paused));
        button.querySelector('i').className = paused ? 'fas fa-play' : 'fas fa-pause';
        button.querySelector('span').textContent = paused ? '動きを再開' : '動きを止める';
        if (window.gsap) gsap.globalTimeline.paused(paused);
        if (window.ScrollTrigger) {
            ScrollTrigger.getAll().forEach(trigger => {
                if (paused) trigger.disable(false);
                else trigger.enable(false, true);
            });
        }
    };

    function initStory() {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const motionToggle = document.getElementById('motionToggle');

        function updateMotionButton() {
            if (!motionToggle) return;
            motionToggle.setAttribute('aria-pressed', String(reduceMotion));
            motionToggle.querySelector('i').className = reduceMotion ? 'fas fa-play' : 'fas fa-pause';
            motionToggle.querySelector('span').textContent = reduceMotion ? '動きを再開' : '動きを止める';
        }

        if (reduceMotion) {
            document.body.classList.add('motion-paused');
            updateMotionButton();
            if (motionToggle) motionToggle.hidden = true;
            return;
        }

        if (!window.gsap || !window.ScrollTrigger) {
            if (motionToggle) motionToggle.hidden = true;
            return;
        }

        gsap.registerPlugin(ScrollTrigger);
        motionToggle.onclick = function () {
            window.toggleDataStoryMotion(motionToggle);
        };

        const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTimeline
            .from('.hero-eyebrow', { y: 18, opacity: 0, duration: 0.45 })
            .from('.data-hero h1', { y: 34, opacity: 0, duration: 0.75 }, '-=0.2')
            .from('.hero-lead, .hero-actions, .hero-trust-list', { y: 24, opacity: 0, duration: 0.6, stagger: 0.12 }, '-=0.35')
            .from('.visual-core', { scale: 0.72, opacity: 0, duration: 0.75 }, '-=0.75')
            .from('.orbit-item, .no-upload-badge', { scale: 0.6, opacity: 0, duration: 0.55, stagger: 0.1 }, '-=0.4');

        gsap.to('.core-pulse', {
            scale: 1.12,
            opacity: 0.2,
            duration: 1.8,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });

        gsap.to('.orbit-one', { rotate: 360, duration: 40, repeat: -1, ease: 'none' });
        gsap.to('.orbit-two', { rotate: -360, duration: 55, repeat: -1, ease: 'none' });

        ScrollTrigger.batch('[data-reveal]', {
            start: 'top 88%',
            once: true,
            onEnter: batch => gsap.from(batch, {
                y: 36,
                opacity: 0,
                duration: 0.7,
                stagger: 0.1,
                ease: 'power3.out'
            })
        });

        gsap.from('[data-journey-step]', {
            scrollTrigger: {
                trigger: '.journey-list',
                start: 'top 82%'
            },
            x: 42,
            opacity: 0,
            duration: 0.65,
            stagger: 0.12,
            ease: 'power3.out'
        });

        gsap.to('.journey-track span', {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
                trigger: '.journey-list',
                start: 'top 70%',
                end: 'bottom 70%',
                scrub: 0.5
            }
        });

        gsap.to('.shield-ring.ring-a', {
            scale: 1.12,
            opacity: 0.45,
            duration: 2.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
        gsap.to('.shield-ring.ring-b', {
            scale: 0.92,
            opacity: 0.3,
            duration: 3,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStory);
    } else {
        initStory();
    }
})();
