document.title = "正在加载";

const link = location.pathname;

document.getElementById("NotFoundShow").classList.remove("hide")
document.getElementById("LinkShow").textContent = link;
document.title = "404未找到";