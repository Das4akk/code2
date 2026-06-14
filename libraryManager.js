// libraryManager.js
class LibraryManager {
  static currentTab = "public";
  static allVideos = [];
  
  static async getDb() {
      const fb = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
      return { ...fb, db: window.db };
  }

  static init() {
    this.bindEvents();
    this.startListening();
  }

  static bindEvents() {
    const btnNavLib = document.getElementById("nav-library");
    if (btnNavLib) {
      btnNavLib.addEventListener("click", () => {
        if (window.FriendsManager && window.FriendsManager.setNavActive) {
            window.FriendsManager.setNavActive("nav-library");
            window.Utils.showScreen("lobby-screen");
        }
        this.renderGrid();
      });
    }

    const btnLibPub = document.getElementById("btn-lib-public");
    const btnLibMy = document.getElementById("btn-lib-my");
    if (btnLibPub && btnLibMy) {
      btnLibPub.onclick = () => {
        this.currentTab = "public";
        btnLibPub.className = "primary-btn";
        btnLibMy.className = "secondary-btn";
        this.renderGrid();
      };
      btnLibMy.onclick = () => {
        this.currentTab = "my";
        btnLibPub.className = "secondary-btn";
        btnLibMy.className = "primary-btn";
        this.renderGrid();
      };
    }

    const searchInput = document.getElementById("library-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => this.renderGrid());
    }

    const btnAdd = document.getElementById("btn-lib-add-video");
    if (btnAdd) {
      btnAdd.onclick = () => this.showAddModal();
    }
  }

  static async startListening() {
    // Listen to library db
    try {
        const { ref: dbRef, onValue, db } = await this.getDb();
        
        onValue(dbRef(db, "library"), (snap) => {
            const data = snap.val() || {};
            const parsed = [];
            // public
            if (data.public) {
                for (let [id, val] of Object.entries(data.public)) {
                    parsed.push({ ...val, id, isPublic: true });
                }
            }
            // users (my library)
            if (data.users && window.AppState && window.AppState.currentUser) {
                const myData = data.users[window.AppState.currentUser.uid];
                if (myData) {
                    for (let [id, val] of Object.entries(myData)) {
                        parsed.push({ ...val, id, isPublic: false });
                    }
                }
            }
            this.allVideos = parsed.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
            this.renderGrid();
        });
    } catch(e) {
        console.error("[LibraryManager] DB listening error:", e);
    }
  }

  static getYoutubeThumb(url) {
    if(!url) return "";
    let vidIdLine = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
    let vidId = vidIdLine && vidIdLine[1] ? vidIdLine[1] : null;
    if (url.includes("rutube.ru/video/")) {
        vidIdLine = url.match(/rutube\.ru\/video\/([a-zA-Z0-9]+)/);
        vidId = vidIdLine && vidIdLine[1] ? vidIdLine[1] : null;
        if(vidId) return "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp"; // fallback for rutube
    }
    return vidId ? `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg` : "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Television.webp";
  }

  static renderGrid() {
    const grid = document.getElementById("library-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const searchQ = (document.getElementById("library-search")?.value || "").toLowerCase();

    let filtered = this.allVideos.filter(v => {
        if (this.currentTab === "public" && !v.isPublic) return false;
        if (this.currentTab === "my" && v.isPublic) return false;
        
        if (searchQ) {
            const t = (v.title || "").toLowerCase();
            const d = (v.description || "").toLowerCase();
            return t.includes(searchQ) || d.includes(searchQ);
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">В этой библиотеке пока ничего нет.</div>`;
        return;
    }

    filtered.forEach(v => {
        const card = document.createElement("div");
        card.className = "room-card";
        const thumbUrl = this.getYoutubeThumb(v.url);
        
        card.innerHTML = `
            <div class="room-preview">
                <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover;">
                <div class="room-preview-overlay"></div>
                ${v.isPublic ? '' : '<div style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.7); padding:4px 8px; border-radius:6px; font-size:11px; display:flex; align-items:center; gap:4px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:1.2em;height:1.2em;" /> Личное</div>'}
            </div>
            <div class="room-info">
                <h4 class="rm-title">${window.Utils.escapeHtml(v.title || "Без названия")}</h4>
                <div class="room-meta">
                    <span class="rm-host" style="max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        Добавлено: ${window.Utils.escapeHtml(v.addedByName || "Аноним")}
                    </span>
                </div>
            </div>
        `;
        card.onclick = () => this.showViewModal(v);
        grid.appendChild(card);
    });
  }

  // MODALS GENERATION
  static getOrCreateModal(id) {
    let m = document.getElementById(id);
    if (!m) {
        m = document.createElement("div");
        m.id = id;
        m.className = "modal";
        document.body.appendChild(m);
    }
    return m;
  }

  static closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove("active");
  }

  static showAddModal() {
    const modal = this.getOrCreateModal("modal-lib-add");
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px">
            <div class="modal-header">
                <h2>Добавить видео в библиотеку</h2>
            </div>
            <div style="margin-bottom: 15px">
                <label style="display:block; margin-bottom:5px; color:var(--text-muted); font-size:13px;">Ссылка на видео (YouTube/Rutube)</label>
                <input type="text" id="lib-add-url" class="settings-input" placeholder="https://..." />
            </div>
            <div id="lib-ai-fields-container" style="position:relative;">
                <div id="lib-ai-lock-overlay" style="display:none; position:absolute; inset:-10px; background:rgba(10,10,15,0.7); backdrop-filter:blur(8px); z-index:10; border-radius:16px; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
                    <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:48px;height:48px;margin-bottom:10px;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5));" />
                    <div style="color:#fff; font-weight:600; font-size:14px;">Нейросеть пишет описание...</div>
                    <div style="color:var(--text-muted); font-size:12px; margin-top:4px;">Пожалуйста, подождите</div>
                </div>
                <div style="margin-bottom: 15px">
                    <label style="display:block; margin-bottom:5px; color:var(--text-muted); font-size:13px;">Название</label>
                    <input type="text" id="lib-add-title" class="settings-input" placeholder="Точное название" />
                </div>
                <div style="margin-bottom: 20px">
                    <label style="display:block; margin-bottom:5px; color:var(--text-muted); font-size:13px;">Описание (мин. 40 символов)</label>
                    <textarea id="lib-add-desc" class="settings-input" rows="4" placeholder="Подробное описание..."></textarea>
                </div>
            </div>
            <div style="margin-bottom: 20px; display:flex; gap:10px; align-items:center;">
                <input type="checkbox" id="lib-add-public" checked style="width:18px; height:18px;" />
                <label for="lib-add-public" style="font-size:14px;">Опубликовать в общую библиотеку</label>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="secondary-btn" id="lib-add-cancel" style="flex:1">Отмена</button>
                <button class="primary-btn" id="lib-add-submit" style="flex:1">Далее</button>
            </div>
        </div>
    `;
    modal.classList.add("active");

    const inputUrl = modal.querySelector("#lib-add-url");
    const inputTitle = modal.querySelector("#lib-add-title");
    const inputDesc = modal.querySelector("#lib-add-desc");
    const lockOverlay = modal.querySelector("#lib-ai-lock-overlay");
    
    let fetchTimeout;
    inputUrl.addEventListener('input', () => {
        clearTimeout(fetchTimeout);
        fetchTimeout = setTimeout(async () => {
            const val = inputUrl.value.trim();
            if(!val || val.length < 5) return;
            // Fetch metadata
            try {
                if (lockOverlay) lockOverlay.style.display = "flex";
                inputTitle.disabled = true;
                inputDesc.disabled = true;
                
                const res = await fetch("/api/library/fetch-metadata", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ url: val })
                });
                const data = await res.json();
                if(data.success) {
                    if (data.title && !inputTitle.value) inputTitle.value = data.title;
                    if (data.description && !inputDesc.value) inputDesc.value = data.description;
                }
            } catch(e) {
                console.error("fetch metadata failed", e);
            } finally {
                if (lockOverlay) lockOverlay.style.display = "none";
                inputTitle.disabled = false;
                inputDesc.disabled = false;
            }
        }, 1000);
    });

    const btnCancel = modal.querySelector("#lib-add-cancel");
    btnCancel.onclick = () => this.closeModal("modal-lib-add");

    const btnSubmit = modal.querySelector("#lib-add-submit");
    btnSubmit.onclick = async () => {
        if (!window.AppState || !window.AppState.currentUser) return window.Utils.toast("Вы не авторизованы!", "error");
        const url = document.getElementById("lib-add-url").value.trim();
        const title = document.getElementById("lib-add-title").value.trim();
        const desc = document.getElementById("lib-add-desc").value.trim();
        const isPublic = document.getElementById("lib-add-public").checked;

        if (!url) return window.Utils.toast("Введите ссылку");
        if (!title) return window.Utils.toast("Введите название");
        if (desc.length < 40) return window.Utils.toast("Описание должно быть минимум 40 символов", "error");

        this.closeModal("modal-lib-add");

        const uid = window.AppState.currentUser.uid;
        const uProfile = window.AppState.usersCache.get(uid);
        const name = uProfile?.name || window.AppState.currentUser.displayName || "User";

        const thumb = this.getYoutubeThumb(url);
        
        const videoData = {
            url, title, description: desc,
            addedByUid: uid,
            addedByName: name,
            timestamp: Date.now()
        };

        if (isPublic && thumb && !thumb.includes("Telegram-Animated-Emojis")) {
            // Initiate AI verification
            this.showAiVerificationModal(videoData, thumb);
        } else {
            // Direct save
            videoData.people = "Не определено";
            this.saveVideo(videoData, isPublic);
        }
    };
  }

  static async showAiVerificationModal(videoData, thumbUrl) {
      const modal = this.getOrCreateModal("modal-lib-ai-verify");
      modal.innerHTML = `
          <div class="modal-content" style="max-width: 500px">
              <div class="modal-header">
                  <h2>Определение лиц (ИИ) <img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Smileys/Robot.webp" style="width: 1.2em; height: 1.2em; vertical-align: bottom" /></h2>
              </div>
              <div style="text-align:center; margin-bottom:15px;">
                  <img src="${thumbUrl}" style="max-width:100%; border-radius:12px; max-height:200px; object-fit:cover;" />
              </div>
              <p style="font-size:14px; text-align:center; color:var(--text-muted); margin-bottom:15px;">
                 ИИ анализирует, кто изображен на превью...
              </p>
              <div id="ai-loading" style="text-align:center; margin-bottom:15px;">
                 <div class="spinner" style="margin: 0 auto;"></div>
              </div>
              <div id="ai-result-area" style="display:none;">
                <p style="font-size:14px; margin-bottom:10px;">Верно ли определены участники видео?</p>
                <input type="text" id="lib-add-people" class="settings-input" style="margin-bottom:10px;" />
                <p style="font-size:11px; color:#ff5555; text-align:center; margin-bottom:15px;">
                  * ИИ может ошибаться. Если ответ неверный, исправьте его вручную. Если людей нет, напишите "Никого".
                </p>
                <div style="display:flex; gap:10px;">
                    <button class="primary-btn" id="lib-verify-submit" style="flex:1">Подтвердить и Опубликовать</button>
                </div>
              </div>
          </div>
      `;
      modal.classList.add("active");

      try {
          const res = await fetch("/api/library/analyze-preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  imageUrl: thumbUrl,
                  title: videoData.title,
                  description: videoData.description
              })
          });
          const data = await res.json();
          const peopleStr = data.success ? data.people : "Ошибка ИИ. Впишите вручную.";
          
          modal.querySelector("#ai-loading").style.display = "none";
          modal.querySelector("#ai-result-area").style.display = "block";
          modal.querySelector("#lib-add-people").value = peopleStr;

          modal.querySelector("#lib-verify-submit").onclick = () => {
              const p = modal.querySelector("#lib-add-people").value.trim();
              videoData.people = p || "Не определено";
              this.closeModal("modal-lib-ai-verify");
              this.saveVideo(videoData, true);
          };

      } catch (err) {
          modal.querySelector("#ai-loading").style.display = "none";
          modal.querySelector("#ai-result-area").style.display = "block";
          modal.querySelector("#lib-add-people").value = "";
          modal.querySelector("#lib-verify-submit").onclick = () => {
              const p = modal.querySelector("#lib-add-people").value.trim();
              videoData.people = p || "Не определено";
              this.closeModal("modal-lib-ai-verify");
              this.saveVideo(videoData, true);
          };
      }
  }

  static async saveVideo(videoData, isPublic) {
      try {
          const { ref: dbRef, push, db } = await this.getDb();
          const basePath = isPublic ? "library/public" : `library/users/${videoData.addedByUid}`;
          await push(dbRef(db, basePath), videoData);
          window.Utils.toast("Видео успешно добавлено в библиотеку!", "success");
      } catch (e) {
          console.error(e);
          window.Utils.toast("Ошибка при сохранении видео", "error");
      }
  }

  static showViewModal(v) {
      const modal = this.getOrCreateModal("modal-lib-view");
      const thumbUrl = this.getYoutubeThumb(v.url);

      modal.innerHTML = `
          <div class="modal-content" style="max-width: 600px; padding: 0; overflow: hidden; position: relative;">
              <div style="height: 250px; background: #000; position:relative;">
                   <button class="secondary-btn btn-close-modal" id="btn-lib-close-view" style="position:absolute; top:10px; right:10px; z-index:10; background:rgba(0,0,0,0.5); border:none; padding:8px 12px; width:auto;">✕</button>
                   <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover; opacity: 0.9;" />
                   <div style="position:absolute; bottom:0; left:0; right:0; height:100px; background:linear-gradient(to top, var(--panel), transparent);"></div>
              </div>
              
              <div style="padding: 24px; position:relative; z-index:5;">
                  <h2 style="font-size:24px; margin-bottom:8px;">${window.Utils.escapeHtml(v.title)}</h2>
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-size:13px; color:var(--text-muted);">
                      <span>Добавил(а): <strong style="color:var(--text-main);">${window.Utils.escapeHtml(v.addedByName)}</strong></span>
                      ${v.isPublic ? `<span style="display:inline-flex;align-items:center;gap:4px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/People/Busts%20In%20Silhouette.webp" style="width:1.2em;height:1.2em;"/> На превью: <strong style="color:var(--accent);">${window.Utils.escapeHtml(v.people || "Не распознано")}</strong></span>` : ""}
                  </div>
                  
                  <div style="background:rgba(255,255,255,0.03); border-radius:12px; padding:16px; margin-bottom:24px; border:1px solid var(--border-light);">
                      <p style="font-size:14px; line-height:1.6; color:#ddd; white-space:pre-wrap;">${window.Utils.escapeHtml(v.description)}</p>
                  </div>

                  <button class="primary-btn" id="btn-lib-create-room" style="font-size:16px; padding:16px; border-radius:12px;"><img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Food%20and%20Drink/Popcorn.webp" style="width: 1.2em; height: 1.2em; vertical-align: bottom" /> Создать комнату с этим видео</button>
              </div>
          </div>
      `;
      modal.classList.add("active");

      modal.querySelector("#btn-lib-close-view").onclick = () => this.closeModal("modal-lib-view");
      
      modal.querySelector("#btn-lib-create-room").onclick = () => {
          this.closeModal("modal-lib-view");
          // trigger create room mechanics
          window.AppState.pendingLibraryVideoUrl = v.url;
          if (document.getElementById("btn-open-create-room")) {
              document.getElementById("btn-open-create-room").click();
              setTimeout(() => {
                  const urlInput = document.getElementById("room-input-url");
                  if (urlInput) {
                      urlInput.value = v.url;
                      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
                  const nameInput = document.getElementById("room-input-name");
                  if (nameInput) {
                      nameInput.value = v.title;
                      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
                  }
              }, 100);
          }
      };
  }

  static bindAdminPanel() {
      const btnSearch = document.getElementById("btn-admin-lib-search");
      if (btnSearch) {
          btnSearch.onclick = () => this.searchAdminLibrary();
      }
      
      const btnSave = document.getElementById("btn-admin-lib-save");
      if (btnSave) {
          btnSave.onclick = async () => {
              const id = document.getElementById("admin-lib-edit-id").value;
              const path = document.getElementById("admin-lib-edit-path").value;
              if (!id || !path) return window.Utils.toast("Выберите видео для редактирования", "error");
              
              const title = document.getElementById("admin-lib-edit-title").value.trim();
              const desc = document.getElementById("admin-lib-edit-desc").value.trim();
              const url = document.getElementById("admin-lib-edit-url").value.trim();
              const people = document.getElementById("admin-lib-edit-people").value.trim();
              
              try {
                  const { ref: dbRef, update, db } = await this.getDb();
                  await update(dbRef(db, path), { title, description: desc, url, people });
                  window.Utils.toast("Изменения сохранены", "success");
                  this.searchAdminLibrary();
              } catch (e) {
                  window.Utils.toast("Ошибка: " + e.message, "error");
              }
          }
      }

      const btnDel = document.getElementById("btn-admin-lib-delete");
      if (btnDel) {
          btnDel.onclick = async () => {
              const id = document.getElementById("admin-lib-edit-id").value;
              const path = document.getElementById("admin-lib-edit-path").value;
              if (!id || !path) return window.Utils.toast("Выберите видео", "error");
              
              if(await window.Utils.confirm("Точно удалить это видео?")) {
                  try {
                      const { ref: dbRef, remove, db } = await this.getDb();
                      await remove(dbRef(db, path));
                      window.Utils.toast("Удалено", "success");
                      
                      document.getElementById("admin-lib-edit-id").value = "";
                      document.getElementById("admin-lib-edit-path").value = "";
                      document.getElementById("admin-lib-edit-title").value = "";
                      document.getElementById("admin-lib-edit-desc").value = "";
                      document.getElementById("admin-lib-edit-url").value = "";
                      document.getElementById("admin-lib-edit-people").value = "";
                      
                      this.searchAdminLibrary();
                  } catch (e) {}
              }
          }
      }
  }

  static async searchAdminLibrary() {
      const q = (document.getElementById("admin-lib-search").value || "").toLowerCase().trim();
      const list = document.getElementById("admin-lib-list");
      list.innerHTML = "Загрузка...";
      
      try {
          const { ref: dbRef, get, db } = await this.getDb();
          const snap = await get(dbRef(db, "library"));
          const data = snap.val() || {};
          
          let results = [];
          const addRes = (v, parentPath, isPublic) => {
              if (!q || (v.title||"").toLowerCase().includes(q) || (v.description||"").toLowerCase().includes(q) || parentPath.includes(q)) {
                  results.push({ ...v, path: parentPath, isPublic });
              }
          };

          if (data.public) {
              for (let id in data.public) addRes(data.public[id], `library/public/${id}`, true);
          }
          if (data.users) {
              for (let uid in data.users) {
                  for (let id in data.users[uid]) addRes(data.users[uid][id], `library/users/${uid}/${id}`, false);
              }
          }

          list.innerHTML = "";
          if (results.length === 0) {
              list.innerHTML = "<div style='color:var(--text-muted); font-size:12px;'>Ничего не найдено</div>";
              return;
          }
          
          results.forEach(v => {
              const item = document.createElement("div");
              item.style = "background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px; border:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center; cursor:pointer;";
              item.innerHTML = `<div style="font-size:13px; max-width:80%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:4px;">${v.isPublic===false?'<img src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main/Objects/Locked%20With%20Key.webp" style="width:1.2em;height:1.2em;" /> ':""} <span>${window.Utils.escapeHtml(v.title||"Без названия")} <span style="opacity:0.5">(${v.addedByName})</span></span></div>`;
              
              item.onclick = () => {
                  document.getElementById("admin-lib-edit-id").value = v.id || v.path;
                  document.getElementById("admin-lib-edit-path").value = v.path;
                  document.getElementById("admin-lib-edit-title").value = v.title || "";
                  document.getElementById("admin-lib-edit-desc").value = v.description || "";
                  document.getElementById("admin-lib-edit-url").value = v.url || "";
                  document.getElementById("admin-lib-edit-people").value = v.people || "";
              };
              
              list.appendChild(item);
          });
      } catch (e) {
          list.innerHTML = "<div style='color:#ff5555; font-size:12px;'>Ошибка загрузки</div>";
      }
  }

}
window.LibraryManager = LibraryManager;
