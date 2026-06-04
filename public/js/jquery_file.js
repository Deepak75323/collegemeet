

const navmenu=document.getElementById('sidebar'),
navToggle=document.getElementById('nav-toggle'),
navClose=document.getElementById('nav-close');


if(navToggle)
{ 
navToggle.addEventListener("click",()=>
{ 
navmenu.classList.add("show-sidebar");

})}

if(navClose)
{ 
navClose.addEventListener("click",()=>
{ 
navmenu.classList.remove("show-sidebar");

})}





const tabs=document.querySelectorAll('[data-target]'),
tabContent=document.querySelectorAll('[data-content]')

        tabs.forEach(tab=>
            {
                tab.addEventListener("click",()=>
                {
                    const target=document.querySelector(tab.dataset.target)
                    tabContent.forEach(tabContents=>
                        {
                          tabContents.classList.remove('skills__active') 
                        }) 

                    target.classList.add('skills__active')


                    tabs.forEach(tab=>
                        {
                          tab.classList.remove('skills__active') 
                        }) 

                    tab.classList.add('skills__active')
                })

            })






    const linkwork=document.querySelectorAll(".work__item");
    // console.log(linkwork);
          


    // const workactive= document.getElementsByClassName("active-work")
    // console.log(workactive);
   

      function check(e)
      {
        
        for(let values of linkwork)
            {
              // console.log(values);
              if(values.classList.contains('active-work'))
              {
                values.classList.remove('active-work');
              }
            }

            if(e.target.classList.add('active-work'));


      }

      for(let values of linkwork)
      {

        values.addEventListener('click',check);

      }


        
      

         






     
(function () {
  var loginText = document.querySelector('.title-text .login');
  var loginForm = document.querySelector('form.login');
  var loginBtn = document.querySelector('label.login');
  var signupBtn = document.querySelector('label.signup');
  var signupLink = document.querySelector('form .signup-link a');
  if (!signupBtn || !loginForm || !loginText) return;

  function showSignup() {
    loginForm.style.marginLeft = '-50%';
    loginText.style.marginLeft = '-50%';
  }

  function showLogin() {
    loginForm.style.marginLeft = '0%';
    loginText.style.marginLeft = '0%';
  }

  signupBtn.addEventListener('click', showSignup);
  loginBtn.addEventListener('click', showLogin);
  if (signupLink) {
    signupLink.addEventListener('click', function (e) {
      e.preventDefault();
      signupBtn.click();
    });
  }

  var signupRadio = document.getElementById('signup');
  if (signupRadio && signupRadio.checked) {
    showSignup();
  }
})();






const inputs=document.querySelectorAll('input');

function focusFunc()
{
let parent=this.paretNode;
parent.classList.add('focus');
}

function blurFunc()
{

let parent=this.paretNode;
if(this.value=="")
{
 parent.classList.remove('focus');
}
}

inputs.forEach((input)=>{
input.addEventListener('focus',focusFunc);
input.addEventListener('blur',blurFunc);
})








// room


