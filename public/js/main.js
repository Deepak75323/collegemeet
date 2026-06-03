

$(document).ready(function(){
    $(window).scroll(function(){
        // sticky navbar on scroll script
        if(this.scrollY > 20){
            $('.navbar').addClass("sticky");
        }else{
            $('.navbar').removeClass("sticky");
        }
        
        // scroll-up button show/hide script
        if(this.scrollY > 500){
            $('.scroll-up-btn').addClass("show");
        }else{
            $('.scroll-up-btn').removeClass("show");
        }
    });


});


$(document).ready(function(){

    var typed = new Typed(".typing", {
        strings: ["Developer", "Blogger", "Frontend Designer", "Freelancer"],
        typeSpeed: 100,
        backSpeed: 60,
        loop: true
    });




});


$(document).ready(function(){



    
    var postsGrid = document.getElementById('posts-grid');
    if (!postsGrid) return;

    var mixerBlog = mixitup('#posts-grid', {
        selectors: {
            target: '.notice-card'
        },
        animation: {
            duration: 300
        }
    });
    window.mixerBlog = mixerBlog;



});


$(document).ready(function(){
    $('.content').click(function(){
      $('.content').toggleClass("heart-active")
      $('.text').toggleClass("heart-active")
      $('.numb').toggleClass("heart-active")
      $('.heart').toggleClass("heart-active")
    });
  });




  


