import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC3SSWRF6FoB-XaYMbEnGw98B3bdwwtAAA",
  authDomain: "duanweb-6a36c.firebaseapp.com",
  projectId: "duanweb-6a36c",
  storageBucket: "duanweb-6a36c.firebasestorage.app",
  messagingSenderId: "328219544706",
  appId: "1:328219544706:web:5aef6d9228fda624d1b89b",
  measurementId: "G-BN14CT1ED3"
};

const OWNER_UID = "Tkavc9HhcJb3UaI0fEsZPYfocp93";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const grid = document.querySelector("#project-grid");
const dialog = document.querySelector("#project-dialog");
const form = document.querySelector("#project-form");
const imageInput = document.querySelector("#project-image");
const imageFilename = document.querySelector("#image-filename");
const toast = document.querySelector("#toast");

let projects = [];
let toastTimer;

document.querySelector("#year").textContent = new Date().getFullYear();

document.querySelector("#close-modal").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

document.querySelector("#open-modal").addEventListener("click", () => {
  if (auth.currentUser?.uid !== OWNER_UID) {
    showToast("Chỉ tài khoản chủ trang mới được thêm dự án.");
    return;
  }
  dialog.showModal();
});

imageInput.addEventListener("change", () => {
  imageFilename.textContent = imageInput.files[0]?.name || "";
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (auth.currentUser?.uid !== OWNER_UID) {
    showToast("Chỉ tài khoản chủ trang mới được thêm dự án.");
    return;
  }

  const submitButton = form.querySelector(".submit-button");
  submitButton.disabled = true;
  submitButton.textContent = "Đang lưu...";

  try {
    const data = new FormData(form);
    const file = imageInput.files[0];
    const image = file ? await compressImage(file) : "";

    await addDoc(collection(db, "projects"), {
      title: data.get("title").trim(),
      description: data.get("description").trim(),
      category: data.get("category").trim() || "Dự án cá nhân",
      link: normalizeLink(data.get("link").trim()),
      image,
      createdAt: serverTimestamp()
    });

    form.reset();
    imageFilename.textContent = "";
    dialog.close();
    showToast("Đã thêm dự án.");
  } catch (error) {
    showToast(error.message || "Không thể lưu dự án.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Lưu dự án <span>↗</span>';
  }
});

grid.addEventListener("click", async event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  if (auth.currentUser?.uid !== OWNER_UID) {
    showToast("Chỉ tài khoản chủ trang mới được xóa dự án.");
    return;
  }

  try {
    await deleteDoc(doc(db, "projects", button.dataset.delete));
    showToast("Đã xóa dự án.");
  } catch {
    showToast("Không thể xóa dự án.");
  }
});

onSnapshot(collection(db, "projects"), snapshot => {
  projects = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  projects.sort((a, b) =>
    (b.createdAt?.toMillis?.() || 0) -
    (a.createdAt?.toMillis?.() || 0)
  );

  renderProjects();
}, () => {
  showToast("Không tải được dữ liệu. Kiểm tra Firestore Rules.");
});

onAuthStateChanged(auth, user => {
  const isOwner = user?.uid === OWNER_UID;
  document.querySelector("#open-modal").hidden = !isOwner;
  renderProjects();
});

window.loginPortfolio = async function () {
  const email = prompt("Email:");
  if (!email) return;

  const password = prompt("Mật khẩu:");
  if (!password) return;

  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    showToast("Đăng nhập thành công.");
  } catch {
    showToast("Email hoặc mật khẩu không đúng.");
  }
};

window.logoutPortfolio = async function () {
  await signOut(auth);
  showToast("Đã đăng xuất.");
};

function normalizeLink(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Vui lòng chọn tệp hình ảnh."));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Ảnh phải nhỏ hơn 8 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(new Error("Ảnh không hợp lệ."));
      image.onload = () => {
        const scale = Math.min(1, 900 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function renderProjects() {
  const isOwner = auth.currentUser?.uid === OWNER_UID;

  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>Dự án đầu tiên sẽ xuất hiện ở đây ✨</strong>
      </div>`;
    return;
  }

  grid.innerHTML = projects.map(project => {
    const safeImage =
      typeof project.image === "string" &&
      project.image.startsWith("data:image/")
        ? project.image
        : "";

    const visual = safeImage
      ? `<img class="project-image" src="${safeImage}" alt="Ảnh dự án ${escapeHtml(project.title)}">`
      : `<div class="project-placeholder" aria-hidden="true">
          <span class="placeholder-symbol">✳</span>
        </div>`;

    const link = project.link
      ? `<a class="project-link" href="${escapeHtml(project.link)}"
          target="_blank" rel="noopener noreferrer">Xem dự án ↗</a>`
      : "<span></span>";

    const deleteButton = isOwner
      ? `<button class="delete-project" type="button"
          data-delete="${escapeHtml(project.id)}"
          aria-label="Xóa ${escapeHtml(project.title)}">Xóa</button>`
      : "";

    return `
      <article class="project-card">
        ${visual}
        <div class="project-info">
          <span class="project-category">
            ${escapeHtml(project.category || "Dự án cá nhân")}
          </span>
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.description)}</p>
          <div class="project-card-bottom">
            ${link}
            ${deleteButton}
          </div>
        </div>
      </article>`;
  }).join("");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}
const themeToggle = document.querySelector("#theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (!themeToggle) return;

  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark"
      ? "Chuyển sang chế độ sáng"
      : "Chuyển sang chế độ tối"
  );
}

applyTheme(document.documentElement.dataset.theme || "light");

themeToggle?.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);
  localStorage.setItem("portfolio-theme", nextTheme);
});