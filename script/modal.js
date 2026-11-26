// modal.js
document.addEventListener('DOMContentLoaded', () => {
    
    // Function to set up a modal
    function setupModal(openBtnId, modalId, closeBtnId, agreeBtnId) {
        const modal = document.getElementById(modalId);
        const openBtn = document.getElementById(openBtnId);
        const closeBtn = document.getElementById(closeBtnId);
        const agreeBtn = document.getElementById(agreeBtnId);

        // Only run if elements exist on the page
        if (openBtn && modal) {
            
            // Open modal
            openBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Stop page jump
                modal.classList.add('active');
            });

            // Close modal via 'X' button
            closeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });

            // Close modal via 'I Understand' button
            agreeBtn.addEventListener('click', () => {
                modal.classList.remove('active');
            });

            // Close modal if user clicks outside the white box
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    }

    // Setup Terms of Service Modal
    setupModal('openTermsBtn', 'termsModal', 'closeTermsBtn', 'agreeTermsBtn');

    // Setup Privacy Policy Modal
    setupModal('openPrivacyBtn', 'privacyModal', 'closePrivacyBtn', 'agreePrivacyBtn');

});