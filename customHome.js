"use strict";
// What you want to change	Property
// Text inside an element	element.textContent
// HTML inside an element	element.innerHTML
// An input's value	element.value
// A CSS style	element.style.color = "red"
// A class	element.classList.add("active")
// Any attribute	element.setAttribute("href", "...")

const updateClock = () => {
	const clock = document.getElementById("clock");
	setInterval(() => {
		let parts = new Date().toLocaleTimeString().split(" ")[0].split(":");
		document.getElementById("clock").textContent =
			parts[0] + ":" + parts[1] + ":" + parts[2];
	});
};

function CustomHome() {
	updateClock();
}

CustomHome();
