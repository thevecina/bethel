document.addEventListener("DOMContentLoaded", function(){

    /* BOTONES CON ANIMACION */
    
    const botones = document.querySelectorAll(".btn");
    
    botones.forEach(btn => {
    
    btn.addEventListener("mouseenter", () => {
    
    btn.style.transform = "translateY(-4px) scale(1.05)";
    btn.style.boxShadow = "0 10px 20px rgba(0,0,0,0.25)";
    
    });
    
    btn.addEventListener("mouseleave", () => {
    
    btn.style.transform = "translateY(0) scale(1)";
    btn.style.boxShadow = "none";
    
    });
    
    btn.addEventListener("mousedown", () => {
    
    btn.style.transform = "scale(0.95)";
    
    });
    
    btn.addEventListener("mouseup", () => {
    
    btn.style.transform = "scale(1.05)";
    
    });
    
    });
    
    
    /* ANIMACION AL BAJAR (SCROLL SUAVE) */
    
    const elementos = document.querySelectorAll(".card, .historia-texto, .section-title");
    
    const observer = new IntersectionObserver(entries => {
    
    entries.forEach(entry => {
    
    if(entry.isIntersecting){
    
    entry.target.style.opacity = "1";
    entry.target.style.transform = "translateY(0)";
    
    }
    
    });
    
    },{
    threshold:0.2
    });
    
    elementos.forEach(el => {
    
    el.style.opacity = "0";
    el.style.transform = "translateY(40px)";
    el.style.transition = "0.8s";
    
    observer.observe(el);
    
    });
    
    
    /* PARALLAX SUAVE EN IMAGENES */
    
    const imagenHistoria = document.querySelector(".historia img");
    
    window.addEventListener("scroll",()=>{
    
    let scroll = window.scrollY;
    
    if(imagenHistoria){
    
    imagenHistoria.style.transform =
    "translateY(" + scroll * 0.05 + "px)";
    
    }
    
    });
    
    
    /* WHATSAPP BURBUJA ANIMADA */
    
    const whatsapp = document.querySelector(".whatsapp-bubble");
    
    let direccion = 1;
    
    setInterval(()=>{
    
    if(whatsapp){
    
    whatsapp.style.transform =
    "translateY(" + (direccion * 6) + "px)";
    
    direccion *= -1;
    
    }
    
    },900);
    
    
    /* REACCION AL PASAR EL MOUSE */
    
    if(whatsapp){
    
    whatsapp.addEventListener("mouseenter",()=>{
    
    whatsapp.style.transform = "scale(1.2)";
    whatsapp.style.boxShadow = "0 10px 30px rgba(0,0,0,0.4)";
    
    });
    
    whatsapp.addEventListener("mouseleave",()=>{
    
    whatsapp.style.transform = "scale(1)";
    whatsapp.style.boxShadow = "0 6px 15px rgba(0,0,0,0.3)";
    
    });
    
    }
    
    
    /* EFECTO HEADER AL BAJAR */
    
    const header = document.querySelector("header");
    
    window.addEventListener("scroll",()=>{
    
    if(window.scrollY > 80){
    
    header.style.background = "#1B1B1B";
    header.style.boxShadow = "0 5px 20px rgba(0,0,0,0.4)";
    
    }else{
    
    header.style.background = "#2A2A2A";
    header.style.boxShadow = "none";
    
    }
    
    });
    
    
    /* CARGA SUAVE */
    
    window.addEventListener("load",()=>{
    
    document.body.style.opacity="1"
    
    });
    
    });