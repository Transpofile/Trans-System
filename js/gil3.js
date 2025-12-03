function protectSourceCode() {
document.addEventListener('contextmenu', function(e) {
e.preventDefault();
});

document.addEventListener('keydown', function(e) {
if (e.keyCode === 123 ||
(e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
(e.ctrlKey && e.keyCode === 85) ||
(e.ctrlKey && e.shiftKey && e.keyCode === 67) ||
(e.ctrlKey && e.keyCode === 83) ||
(e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
(e.ctrlKey && e.shiftKey && e.keyCode === 74)) {
e.preventDefault();
return false;
}
});

document.addEventListener('selectstart', function(e) {
e.preventDefault();
});

document.addEventListener('dragstart', function(e) {
e.preventDefault();
});
a
document.onselectstart = function() {
return false;
};

document.oncontextmenu = function() {
return false;
};
}

window.addEventListener('load', protectSourceCode);
window.addEventListener('blur', () => {
// Re-apply protection when window regains focus, just in case
});
