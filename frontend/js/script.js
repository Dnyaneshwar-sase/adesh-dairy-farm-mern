
document.addEventListener("DOMContentLoaded", function () {
    // Navbar मधील लिंकवर क्लिक केल्यावर mobile menu बंद होईल.
    const navLinks = document.querySelectorAll(
        ".farm-navbar .nav-link"
    );

    const navbarCollapse = document.querySelector(
        ".farm-navbar .navbar-collapse"
    );

    navLinks.forEach(function (link) {
        link.addEventListener("click", function () {
            if (
                navbarCollapse &&
                navbarCollapse.classList.contains("show") &&
                window.bootstrap
            ) {
                const collapse = window.bootstrap.Collapse.getOrCreateInstance(
                    navbarCollapse
                );

                collapse.hide();
            }
        });
    });

    console.log("Adesh Dairy Farm website loaded successfully!");
});
