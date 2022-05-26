

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


        
      

         






     
const loginText = document.querySelector(".title-text .login");
const loginForm = document.querySelector("form.login");
const loginBtn = document.querySelector("label.login");
const signupBtn = document.querySelector("label.signup");
const signupLink = document.querySelector("form .signup-link a");
signupBtn.onclick = (()=>{
  loginForm.style.marginLeft = "-50%";
  loginText.style.marginLeft = "-50%";
});
loginBtn.onclick = (()=>{
  loginForm.style.marginLeft = "0%";
  loginText.style.marginLeft = "0%";
});
signupLink.onclick = (()=>{
  signupBtn.click();
  return false;
});






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


