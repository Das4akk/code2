class ProfileManager {
  static showProfile(uid) {
    return this.openViewProfileModal(uid, true);
  }

  static showUserMiniature(uid) {
    return this.openViewProfileModal(uid, true);
  }

  static getRoleBadgeHtml(profile, uid = null) {
    if (!profile) return "";
    const badges = [];

    const ownerImg = `<span class="role-badge-icon-wrapper" data-tooltip="Создатель платформы" onclick="event.stopPropagation(); if(window.Utils) Utils.showBadgeModal('Создатель', 'Высший ранг платформы. Владелец проекта.', 'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Military%20Medal.webp')"><img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Military%20Medal.webp" class="role-badge-icon" style="width:1.2em;height:1.2em;vertical-align:bottom;" title=""></span>`;
    const adminImg = `<span class="role-badge-icon-wrapper" data-tooltip="Администратор" onclick="event.stopPropagation(); if(window.Utils) Utils.showBadgeModal('Администратор', 'Управляет платформой и модераторами.', 'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Diamond%20With%20A%20Dot.webp')"><img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Diamond%20With%20A%20Dot.webp" class="role-badge-icon" style="width:1.2em;height:1.2em;vertical-align:bottom;" title=""></span>`;
    const modImg = `<span class="role-badge-icon-wrapper" data-tooltip="Модератор комьюнити" onclick="event.stopPropagation(); if(window.Utils) Utils.showBadgeModal('Модератор', 'Поддерживает порядок и помогает пользователям.', 'https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Man%20Police%20Officer.webp')"><img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Man%20Police%20Officer.webp" class="role-badge-icon" style="width:1.2em;height:1.2em;vertical-align:bottom;" title=""></span>`;

    if (AdminPanel.isCreatorProfile(profile, uid)) badges.push(ownerImg);
    else if (AdminPanel.isModeratorProfile(profile, uid)) badges.push(modImg);

    if (
      window.PremiumManager &&
      PremiumManager.hasPaidPremium(profile, uid) &&
      !AdminPanel.isCreatorProfile(profile, uid) &&
      !AdminPanel.isModeratorProfile(profile, uid)
    ) {
      badges.push(`<span class="role-badge badge-premium">Premium</span>`);
    }

    if (profile?.adminBadgeCustom?.text) {
      const custom = profile.adminBadgeCustom;
      const text = Utils.escapeHtml(custom.text);
      const color = Utils.escapeHtml(custom.color || "#ffffff");
      const bg = Utils.escapeHtml(custom.bg || "rgba(120,120,120,0.2)");
      const border = Utils.escapeHtml(
        custom.border || "rgba(255,255,255,0.35)",
      );
      badges.push(
        `<span class="role-badge" style="color:${color}; background:${bg}; border:1px solid ${border}; box-shadow:none;">${text}</span>`,
      );
    }

    if (badges.length > 0)
      return `<span style="margin-left:5px;">${badges.join(" ")}</span>`;
    return "";
  }

  static async checkUsernameAvailability(username, excludeUid = null) {
    const cleanName = username.toLowerCase().trim();
    const developerUid = await AdminPanel.getDeveloperUid();

    if (cleanName === "developer") {
      if (developerUid)
        return Boolean(excludeUid && excludeUid === developerUid);

      const developerSnap = await get(ref(db, "usernames/developer"));
      if (!developerSnap.exists()) return true;
      return developerSnap.val() === excludeUid;
    }

    const snap = await get(ref(db, `usernames/${cleanName}`));
    if (!snap.exists()) return true;
    return snap.val() === excludeUid;
  }

  static async createProfile(
    uid,
    name,
    username,
    email,
    security = {},
    gender = "male",
  ) {
    const cleanName = username.toLowerCase().trim();
    const developerUid = await AdminPanel.getDeveloperUid();
    const isDeveloperProfile = cleanName === "developer";

    if (isDeveloperProfile && developerUid && developerUid !== uid) {
      throw new Error("ID developer зарезервирован");
    }

    let registeredIp = "unavailable";
    try {
      const ipRes = await fetch("https://api64.ipify.org?format=json");
      const ipData = await ipRes.json();
      if (ipData && ipData.ip) registeredIp = ipData.ip;
    } catch (e) {}

    const profileData = {
      name,
      username: cleanName,
      email,
      bio: "",
      avatar: "",
      gender,
      registeredIp,
      lumens: 1, // Приветственный бонус новичка
      background: { color: "#111111", index: 1, url: "", dim: 0.5 }, // [UPDATE]
      hashtags: [],
      createdAt: Date.now(),
      provider: security.provider || this.normalizeProvider(auth.currentUser),
      emailVerified:
        typeof security.emailVerified === "boolean"
          ? security.emailVerified
          : Boolean(auth.currentUser?.emailVerified),
    };
    if (isDeveloperProfile) profileData.role = "creator";

    const updates = {};
    updates[`usernames/${cleanName}`] = uid;
    updates[`users/${uid}/profile`] = profileData;
    if (isDeveloperProfile) updates["admin/creatorUid"] = uid;
    await update(ref(db), updates);

    if (window.LumenManager) {
      await LumenManager.recordTransaction(uid, {
        type: "income",
        amount: 1,
        reason: "Приветственный бонус новичка",
        icon: "sparkles"
      });
    }
  }

  static async updateDailyStreak(uid, profile) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

    let streak = profile.streak || 0;
    const lastLoginDate = profile.lastLoginDate;

    if (lastLoginDate === todayStr) {
      return; // Already logged in today
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

    if (lastLoginDate === yesterdayStr) {
      streak = (streak || 0) + 1;
    } else {
      streak = 1;
    }

    const curLumens = Number(profile.lumens) || 0;
    // 10x economy: 3-8 Lumens daily bonus
    const bonusLumens = streak >= 8 ? 8 : (streak >= 4 ? 5 : 3);
    const newLumens = curLumens + bonusLumens;

    await update(ref(db, `users/${uid}/profile`), {
      streak,
      lastLoginDate: todayStr,
      lumens: newLumens,
    });

    if (AppState.currentUser?.uid === uid) {
      const p = AppState.usersCache.get(uid);
      if (p) {
        p.lumens = newLumens;
        p.streak = streak;
      }
      if (window.LumenManager) {
        LumenManager.updateBalance(newLumens, {
          diff: bonusLumens,
          reason: `Ежедневный вход (Стрик ${streak} дн.)`,
          source: "streak",
          animate: true,
          showFloater: true,
          saveTx: true,
          txType: "income",
          txIcon: "fire"
        });
      } else {
        const hp = Utils.$("header-lumens-count");
        if (hp) hp.textContent = newLumens.toLocaleString();
        const myL = Utils.$("my-lumens-val");
        if (myL) myL.textContent = newLumens.toLocaleString();
      }
      setTimeout(() => {
        Utils.toast(`✨ Ежедневный бонус: +${bonusLumens} Люменов (Стрик ${streak} дн.)!`, "success");
      }, 1500);
    }
  }

  static async ensureProfileExists(user) {
    const snap = await get(ref(db, `users/${user.uid}/profile`));
    if (!snap.exists()) {
      const fallbackUser = `user_${Utils.generateCryptoId(6)}`;
      await this.createProfile(
        user.uid,
        user.displayName || "Guest",
        fallbackUser,
        user.email,
        {
          provider: this.normalizeProvider(user),
          emailVerified: Boolean(user.emailVerified),
        },
      );
      await this.updateDailyStreak(user.uid, {});
    } else {
      await this.updateDailyStreak(user.uid, snap.val());
    }
  }

  static bindMyProfileListener() {
    const uid = AppState.currentUser.uid;
    const profileRef = ref(db, `users/${uid}/profile`);
    const unsub = onValue(profileRef, (snap) => {
      const p = snap.val() || {};
      AppState.usersCache.set(uid, p);
      this.syncProfileSecurityFields(uid, p);
      AdminPanel.hydrateDeveloperUidFromProfile(uid, p);
      AdminPanel.syncSidebarButton(p);

      const badgeHtml = this.getRoleBadgeHtml(p, uid);
      const statusEmoji = window.PremiumManager
        ? PremiumManager.getStatusEmojiHtml(p, uid)
        : "";
      Utils.$("my-name-display").innerHTML =
        `${statusEmoji}${Utils.escapeHtml(p.name)} ${badgeHtml}`;
      Utils.$("my-username-display").innerHTML =
        `@${Utils.escapeHtml(p.username)}` +
        (p.extraUsernames && p.extraUsernames.length > 0
          ? `<br><span style="opacity:0.7;font-size:0.9em;">` +
            p.extraUsernames.map((u) => `@${Utils.escapeHtml(u)}`).join(" | ") +
            `</span>`
          : "");
      Utils.$("my-avatar-display").innerHTML = ProfileManager.getAvatarHtml(p);
      if(Utils.$("lobby-app-bar-avatar")) Utils.$("lobby-app-bar-avatar").innerHTML = ProfileManager.getAvatarHtml(p);

      const currentLumens = Number(p.lumens) || 0;
      if (window.LumenManager) {
        LumenManager.updateBalance(currentLumens, {
          source: "sync",
          animate: false,
          showFloater: false
        });
      } else {
        const headerLumens = Utils.$("header-lumens-count");
        if (headerLumens) headerLumens.textContent = currentLumens.toLocaleString();
        const myL = Utils.$("my-lumens-val");
        if (myL) myL.textContent = currentLumens.toLocaleString();
      }

      if (window.PremiumManager) PremiumManager.syncFromProfile(p, uid);

      RoomManager.syncDeveloperControls(p);
    });
    AppState.activeSubscriptions.push(() => off(profileRef, "value", unsub));

    Utils.$("btn-open-my-profile").onclick = () => this.openEditProfileModal();
    Utils.$("btn-profile-menu").onclick = (e) => {
      e.stopPropagation();
      this.toggleProfileMenu();
    };
    Utils.$("btn-open-security").onclick = () => {
      Utils.$("modal-edit-profile").classList.remove("active");
      document.getElementById("nav-settings").click();
    };
    document.addEventListener("click", () => {
      Utils.$("profile-menu-dropdown")?.classList.remove("active");
    });
  }

  static syncBannerCropPreview(url, pos, dimming) {
    const container = Utils.$("banner-position-container");
    const previewImg = Utils.$("banner-crop-preview-img");
    const cropDimOverlay = Utils.$("banner-crop-dimming-overlay");
    const slider = Utils.$("edit-banner-pos");
    const valText = Utils.$("banner-pos-val");
    const removeBtn = Utils.$("btn-remove-banner");

    if (!url || typeof url !== "string" || !url.trim()) {
      if (container) container.style.display = "none";
      if (previewImg) {
        previewImg.removeAttribute("src");
        previewImg.style.display = "none";
      }
      if (cropDimOverlay) cropDimOverlay.style.display = "none";
      if (removeBtn) removeBtn.style.display = "none";
      return;
    }

    if (container) container.style.display = "block";
    if (previewImg) {
      previewImg.src = url.trim();
      previewImg.style.display = "block";
    }
    if (cropDimOverlay) cropDimOverlay.style.display = "block";
    if (removeBtn) removeBtn.style.display = "inline-flex";

    const currentPos = pos !== undefined ? pos : (slider ? parseInt(slider.value, 10) : 50);
    if (previewImg) previewImg.style.objectPosition = `center ${currentPos}%`;
    if (slider) slider.value = currentPos;
    if (valText) valText.innerText = currentPos + "%";

    const dimSlider = Utils.$("edit-banner-dimming");
    const currentDim = dimming !== undefined ? dimming : (dimSlider ? parseInt(dimSlider.value, 10) : 30);
    if (cropDimOverlay) {
      cropDimOverlay.style.backgroundColor = `rgba(0, 0, 0, ${currentDim / 100})`;
    }
  }

  static applyProfileBanner(containerOrModal, profData) {
    const wrap = Utils.$("profile-banner-wrapper");
    const img = Utils.$("profile-banner-img");
    const overlay = Utils.$("profile-banner-overlay");
    const profContainer = containerOrModal ? (containerOrModal.classList && containerOrModal.classList.contains("tiktok-profile-container") ? containerOrModal : containerOrModal.querySelector ? containerOrModal.querySelector(".tiktok-profile-container") : null) : null;

    const hasBanner = Boolean(profData && profData.bannerUrl && String(profData.bannerUrl).trim());

    if (wrap && img) {
      if (hasBanner) {
        wrap.style.display = "block";
        wrap.classList.remove("is-hidden");
        img.style.display = "block";
        img.src = String(profData.bannerUrl).trim();
        img.style.objectPosition = `center ${profData.bannerPositionY !== undefined ? profData.bannerPositionY : 50}%`;
        wrap.style.background = "transparent";
        if (overlay) {
          overlay.style.display = "block";
          overlay.style.backgroundColor = `rgba(0,0,0,${(profData.bannerDimming !== undefined ? profData.bannerDimming : 30) / 100})`;
        }
        if (profContainer) {
          profContainer.classList.add("has-banner");
          profContainer.classList.remove("no-banner");
        }
      } else {
        wrap.style.display = "none";
        wrap.classList.add("is-hidden");
        img.style.display = "none";
        img.removeAttribute("src");
        if (overlay) overlay.style.display = "none";
        if (profContainer) {
          profContainer.classList.remove("has-banner");
          profContainer.classList.add("no-banner");
        }
      }
    }
  }

  static openEditProfileModal() {
    const p = AppState.usersCache.get(AppState.currentUser.uid) || {};
    Utils.$("edit-name").value = p.name || "";
    Utils.$("edit-username-input").value = p.username || "";
    const level = Math.floor(Math.sqrt((p.xp || 0) / 240));
    const extraContainer = Utils.$("extra-usernames-container");
    const eInps = [
      Utils.$("edit-extra-username-input-1"),
      Utils.$("edit-extra-username-input-2"),
      Utils.$("edit-extra-username-input-3"),
    ];
    if (extraContainer) {
      if (level >= 30) {
        extraContainer.style.display = "block";
        if (eInps[0]) {
          eInps[0].style.display = level >= 30 ? "block" : "none";
          eInps[0].value =
            p.extraUsernames && p.extraUsernames.length > 0
              ? p.extraUsernames[0]
              : "";
        }
        if (eInps[1]) {
          eInps[1].style.display = level >= 50 ? "block" : "none";
          eInps[1].value =
            p.extraUsernames && p.extraUsernames.length > 1
              ? p.extraUsernames[1]
              : "";
        }
        if (eInps[2]) {
          eInps[2].style.display = level >= 100 ? "block" : "none";
          eInps[2].value =
            p.extraUsernames && p.extraUsernames.length > 2
              ? p.extraUsernames[2]
              : "";
        }
      } else {
        extraContainer.style.display = "none";
      }
    }
    const bioEl = Utils.$("edit-bio");
    const bioLimit = window.PremiumManager
      ? PremiumManager.getBioLimit(p, AppState.currentUser?.uid)
      : 200;
    if (bioEl) {
      bioEl.value = p.bio || "";
      bioEl.maxLength = bioLimit;
      bioEl.placeholder = `О себе (до ${bioLimit} символов)`;

      const counterEl = Utils.$("edit-bio-counter");
      if (counterEl) {
        counterEl.innerText = `${bioEl.value.length}/${bioLimit}`;
        bioEl.oninput = () => {
          counterEl.innerText = `${bioEl.value.length}/${bioLimit}`;
        };
      }
    }
    Utils.$("edit-hashtags").value = Array.isArray(p.hashtags)
      ? p.hashtags.join(" ")
      : "";
    Utils.$("edit-avatar-url").value = p.avatar || "";
    Utils.$("edit-banner-url").value = p.bannerUrl || "";
    const currentBannerPos = p.bannerPositionY !== undefined ? p.bannerPositionY : 50;
    if (Utils.$("edit-banner-pos")) Utils.$("edit-banner-pos").value = currentBannerPos;
    if (Utils.$("banner-pos-val")) Utils.$("banner-pos-val").innerText = currentBannerPos + "%";
    const currentBannerDimming = p.bannerDimming !== undefined ? p.bannerDimming : 30;
    Utils.$("edit-banner-dimming").value = currentBannerDimming;
    if (Utils.$("banner-dimming-val")) Utils.$("banner-dimming-val").innerText = currentBannerDimming + "%";
    this.syncBannerCropPreview(p.bannerUrl, currentBannerPos, currentBannerDimming);

    let selectedFrame = p.frame || null;

    let availableFrames = [{ id: null, name: "Нет" }];
    const currentInv = p.inventory || [];

    if (window.CatalogManager && CatalogManager.items) {
      CatalogManager.items
        .filter((i) => i.type === "frame")
        .forEach((frame) => {
          if (currentInv.includes(frame.id)) {
            availableFrames.push({
              id: frame.image,
              name: frame.title,
            });
          }
        });
    }

    currentInv.forEach((invItem, idx) => {
      if (invItem.startsWith("http://") || invItem.startsWith("https://")) {
        if (!availableFrames.some((f) => f.id === invItem)) {
          availableFrames.push({
            id: invItem,
            name: `Спец. рамка #${idx}`,
          });
        }
      }
    });

    const renderFramesCarousel = () => {
      const carousel = Utils.$("profile-frames-carousel");
      if (!carousel) return;
      carousel.innerHTML = availableFrames
        .map(
          (f) => `
                <div class="frame-option" style="
                    width: 60px; height: 60px; flex-shrink: 0;
                    border-radius: 8px; border: 2px solid ${selectedFrame === f.id ? "var(--accent)" : "transparent"};
                    background: rgba(0,0,0,0.3); overflow: hidden; cursor: pointer;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;
                " onclick="window.selectAvatarFrame('${f.id || ""}')" title="${f.name || ""}">
                    ${f.id ? `<img src="${Utils.escapeHtml(f.id)}" style="width:50px;height:50px;object-fit:cover; pointer-events:none;">` : `<span style="font-size:12px;color:var(--text-muted);">✖</span>`}
                </div>
            `,
        )
        .join("");

      const frameImg = Utils.$("edit-avatar-frame");
      if (frameImg) {
        if (selectedFrame) {
          frameImg.src = selectedFrame;
          frameImg.style.display = "block";
        } else {
          frameImg.style.display = "none";
        }
      }
    };

    window.selectAvatarFrame = (frameId) => {
      selectedFrame = frameId || null;
      Utils.$("modal-edit-profile").dataset.selectedFrame = selectedFrame || "";
      renderFramesCarousel();
    };

    renderFramesCarousel();
    Utils.$("modal-edit-profile").dataset.selectedFrame = selectedFrame || "";

    if (p.gender) {
      const rad = document.querySelector(
        `input[name="edit-gender"][value="${p.gender}"]`,
      );
      if (rad) rad.checked = true;
      const genderSelectDiv = document.querySelector(
        "#modal-edit-profile .user-gender-select",
      );
      if (genderSelectDiv) {
        genderSelectDiv.style.display = "none";
      }
    } else {
      const genderSelectDiv = document.querySelector(
        "#modal-edit-profile .user-gender-select",
      );
      if (genderSelectDiv) {
        genderSelectDiv.style.display = "flex";
      }
    }
    this.updateAvatarPreview(p.avatar, p.name);
    this.renderMyPartnerBox(); // [NEW]
    this.renderLoveRequests(); // [NEW]

    Utils.$("modal-edit-profile").classList.add("active");

    // [ADD] Файловые инпуты в Base64 с превью
    
    if (Utils.$("btn-remove-banner")) {
      Utils.$("btn-remove-banner").onclick = () => {
        if (Utils.$("edit-banner-url")) Utils.$("edit-banner-url").value = "";
        if (Utils.$("edit-banner-file")) Utils.$("edit-banner-file").value = "";
        this.syncBannerCropPreview("", 50, 30);
        const bImg = Utils.$("profile-banner-img");
        const bWrap = Utils.$("profile-banner-wrapper");
        const sProf = Utils.$("section-profile");
        const pCont = sProf ? sProf.querySelector(".tiktok-profile-container") : null;
        if (bImg) {
          bImg.style.display = "none";
          bImg.removeAttribute("src");
        }
        if (bWrap) {
          bWrap.style.display = "none";
          bWrap.classList.add("is-hidden");
        }
        if (pCont) {
          pCont.classList.remove("has-banner");
          pCont.classList.add("no-banner");
        }
        Utils.toast("Баннер удален. Нажмите «Сохранить», чтобы применить изменения.", "info");
      };
    }

    if (Utils.$("edit-banner-file")) {
      Utils.$("edit-banner-file").onchange = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const b64 = await Utils.bannerFileToBase64(file);
          if (Utils.$("edit-banner-url")) Utils.$("edit-banner-url").value = b64;
          const pos = Utils.$("edit-banner-pos") ? parseInt(Utils.$("edit-banner-pos").value, 10) : 50;
          const dim = Utils.$("edit-banner-dimming") ? parseInt(Utils.$("edit-banner-dimming").value, 10) : 30;
          this.syncBannerCropPreview(b64, pos, dim);
          const bImg = Utils.$("profile-banner-img");
          const bWrap = Utils.$("profile-banner-wrapper");
          const sProf = Utils.$("section-profile");
          const pCont = sProf ? sProf.querySelector(".tiktok-profile-container") : null;
          if (bImg) {
            bImg.src = b64;
            bImg.style.display = "block";
            bImg.style.objectPosition = `center ${pos}%`;
          }
          if (bWrap) {
            bWrap.style.display = "block";
            bWrap.classList.remove("is-hidden");
            bWrap.style.background = "transparent";
          }
          if (pCont) {
            pCont.classList.add("has-banner");
            pCont.classList.remove("no-banner");
          }
        }
      };
    }
    const triggerBannerPreview = () => {
      const val = Utils.$("edit-banner-url") ? Utils.$("edit-banner-url").value.trim() : "";
      const pos = Utils.$("edit-banner-pos") ? parseInt(Utils.$("edit-banner-pos").value, 10) : 50;
      const dim = Utils.$("edit-banner-dimming") ? parseInt(Utils.$("edit-banner-dimming").value, 10) : 30;
      this.syncBannerCropPreview(val, pos, dim);
      const bImg = Utils.$("profile-banner-img");
      const bWrap = Utils.$("profile-banner-wrapper");
      const sProf = Utils.$("section-profile");
      const pCont = sProf ? sProf.querySelector(".tiktok-profile-container") : null;

      if (val) {
        if (bImg) {
          bImg.src = val;
          bImg.style.display = "block";
          bImg.style.objectPosition = `center ${pos}%`;
        }
        if (bWrap) {
          bWrap.style.display = "block";
          bWrap.classList.remove("is-hidden");
          bWrap.style.background = "transparent";
        }
        if (pCont) {
          pCont.classList.add("has-banner");
          pCont.classList.remove("no-banner");
        }
      } else {
        if (bImg) {
          bImg.style.display = "none";
          bImg.removeAttribute("src");
        }
        if (bWrap) {
          bWrap.style.display = "none";
          bWrap.classList.add("is-hidden");
        }
        if (pCont) {
          pCont.classList.remove("has-banner");
          pCont.classList.add("no-banner");
        }
      }
    };
    if (Utils.$("edit-banner-url")) {
      Utils.$("edit-banner-url").oninput = triggerBannerPreview;
      Utils.$("edit-banner-url").onchange = triggerBannerPreview;
      Utils.$("edit-banner-url").onpaste = () => setTimeout(triggerBannerPreview, 30);
    }
    if (Utils.$("edit-banner-pos")) {
      Utils.$("edit-banner-pos").oninput = (e) => {
        const val = e.target.value;
        if (Utils.$("banner-pos-val")) Utils.$("banner-pos-val").innerText = val + "%";
        if (Utils.$("banner-crop-preview-img")) {
          Utils.$("banner-crop-preview-img").style.objectPosition = `center ${val}%`;
        }
        if (Utils.$("profile-banner-img")) {
          Utils.$("profile-banner-img").style.objectPosition = `center ${val}%`;
        }
      };
    }
    const cropWrap = Utils.$("banner-crop-preview-wrap");
    if (cropWrap && !cropWrap._dragInitialized) {
      cropWrap._dragInitialized = true;
      let isDragging = false;
      let startY = 0;
      let startVal = 50;
      const onStart = (clientY) => {
        isDragging = true;
        startY = clientY;
        startVal = Utils.$("edit-banner-pos") ? parseInt(Utils.$("edit-banner-pos").value, 10) : 50;
        cropWrap.style.cursor = "grabbing";
      };
      const onMove = (clientY) => {
        if (!isDragging) return;
        const dy = clientY - startY;
        const rect = cropWrap.getBoundingClientRect();
        const deltaPercent = Math.round((dy / Math.max(rect.height, 60)) * 100);
        let newVal = Math.max(0, Math.min(100, startVal - deltaPercent));
        if (Utils.$("edit-banner-pos")) Utils.$("edit-banner-pos").value = newVal;
        if (Utils.$("banner-pos-val")) Utils.$("banner-pos-val").innerText = newVal + "%";
        if (Utils.$("banner-crop-preview-img")) {
          Utils.$("banner-crop-preview-img").style.objectPosition = `center ${newVal}%`;
        }
        if (Utils.$("profile-banner-img")) {
          Utils.$("profile-banner-img").style.objectPosition = `center ${newVal}%`;
        }
      };
      const onEnd = () => {
        if (isDragging) {
          isDragging = false;
          cropWrap.style.cursor = "ns-resize";
        }
      };
      cropWrap.addEventListener("mousedown", (e) => onStart(e.clientY));
      window.addEventListener("mousemove", (e) => onMove(e.clientY));
      window.addEventListener("mouseup", onEnd);
      cropWrap.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) onStart(e.touches[0].clientY);
      }, { passive: true });
      window.addEventListener("touchmove", (e) => {
        if (isDragging && e.touches.length === 1) onMove(e.touches[0].clientY);
      }, { passive: true });
      window.addEventListener("touchend", onEnd);
    }
    if (Utils.$("edit-banner-dimming")) {
      Utils.$("edit-banner-dimming").oninput = (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        if (Utils.$("banner-dimming-val")) Utils.$("banner-dimming-val").innerText = val + "%";
        // Live update dimming in visible crop preview
        const cropDimOverlay = Utils.$("banner-crop-dimming-overlay");
        if (cropDimOverlay) {
          cropDimOverlay.style.backgroundColor = `rgba(0, 0, 0, ${val / 100})`;
        }
        // Live update dimming on actual profile banner
        const profBannerOverlay = Utils.$("profile-banner-overlay");
        if (profBannerOverlay) {
          profBannerOverlay.style.backgroundColor = `rgba(0, 0, 0, ${val / 100})`;
        }
      };
    }

    if (Utils.$("edit-avatar-file")) {
      Utils.$("edit-avatar-file").onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const b64 = await Utils.fileToBase64(file, 400); // Ресайз до 400px
          Utils.$("edit-avatar-url").value = b64;
          this.updateAvatarPreview(b64, Utils.$("edit-name").value);
        }
      };
    }

    Utils.$("edit-avatar-url").oninput = Utils.debounce(
      (e) =>
        this.updateAvatarPreview(e.target.value, Utils.$("edit-name").value),
      300,
    );
    Utils.$("edit-name").oninput = Utils.debounce(
      (e) =>
        this.updateAvatarPreview(
          Utils.$("edit-avatar-url").value,
          e.target.value,
        ),
      300,
    );

    Utils.$("btn-save-profile").onclick = async () => {
      const btn = Utils.$("btn-save-profile");
      btn.disabled = true;
      try {
        await this.saveProfile();
        Utils.$("modal-edit-profile").classList.remove("active");
        Utils.toast("Профиль сохранен");
        const uid = AppState.currentUser?.uid;
        if (uid) {
          this.openViewProfileModal(uid).catch(() => {});
        }
      } catch (e) {
        Utils.toast(e.message, "error");
      } finally {
        btn.disabled = false;
      }
    };
  }

  static normalizeProvider(user = null) {
    const authUser = user || auth.currentUser;
    const providerId =
      authUser?.providerData?.[0]?.providerId || authUser?.providerId || "";
    if (providerId === "password") return "email";
    if (providerId === "google.com") return "google";
    return providerId || "email";
  }

  static getCurrentAuthSecurity() {
    const user = auth.currentUser;
    return {
      email: user?.email || "",
      provider: this.normalizeProvider(user),
      emailVerified: Boolean(user?.emailVerified),
    };
  }

  static syncProfileSecurityFields(uid, profile = {}) {
    const authSecurity = this.getCurrentAuthSecurity();
    const needsSync =
      typeof profile.provider === "undefined" ||
      typeof profile.emailVerified === "undefined" ||
      (!profile.email && authSecurity.email) ||
      (profile.email &&
        authSecurity.email &&
        profile.email !== authSecurity.email) ||
      (typeof profile.emailVerified === "boolean" &&
        profile.emailVerified !== authSecurity.emailVerified);
    if (!needsSync) return;
    update(ref(db, `users/${uid}/profile`), {
      email: authSecurity.email || profile.email || "",
      provider: profile.provider || authSecurity.provider,
      emailVerified: authSecurity.emailVerified,
    }).catch(() => {});
  }

  static toggleProfileMenu() {
    Utils.$("profile-menu-dropdown")?.classList.toggle("active");
  }

  static openSecurityModal() {
    document.getElementById("nav-settings").click();
  }

  static renderSecurityModal() {
    const p = AppState.usersCache.get(AppState.currentUser.uid) || {};
    const authSecurity = this.getCurrentAuthSecurity();
    const provider = p.provider || authSecurity.provider;
    const email = p.email || authSecurity.email;
    const emailVerified =
      typeof p.emailVerified === "boolean"
        ? p.emailVerified
        : authSecurity.emailVerified;

    const emailBox = Utils.$("security-email-box");
    const note = Utils.$("security-verified-note");
    const actionBtn = Utils.$("btn-security-email-action");
    const emailInput = Utils.$("security-email-input");
    const passwordInput = Utils.$("security-password-input");

    if (provider === "google") {
      emailBox.innerText = email || "Вы авторизованы через Google";
      actionBtn.innerText = "Изменить почту";
      passwordInput.style.display = "none";

      // Show set password for google users if they haven't explicitly set one
      // We can't perfectly check if password exists, but we can offer to set/reset it
      Utils.$("security-set-password-section").style.display = "block";
      Utils.$("btn-security-set-password").onclick = async () => {
        const newPass = Utils.$("security-new-password").value;
        if (newPass.length < 6)
          return Utils.toast("Пароль минимум 6 символов", "error");

        try {
          const { updatePassword } =
            await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
          await updatePassword(auth.currentUser, newPass);

          // Save to fast-switch cache
          const savedAccounts = JSON.parse(
            localStorage.getItem("cowio_saved_accounts") || "[]",
          );
          const existingAcc = savedAccounts.find(
            (a) => a.uid === auth.currentUser.uid,
          );
          if (existingAcc) {
            existingAcc.pass = newPass;
          } else {
            savedAccounts.push({
              uid: auth.currentUser.uid,
              email: auth.currentUser.email,
              pass: newPass,
            });
          }
          localStorage.setItem(
            "cowio_saved_accounts",
            JSON.stringify(savedAccounts),
          );

          Utils.toast("Пароль успешно установлен!");
          Utils.$("security-new-password").value = "";
        } catch (e) {
          if (e.code === "auth/requires-recent-login") {
            Utils.toast(
              "Нужна повторная авторизация. Перезайдите в аккаунт.",
              "error",
            );
          } else {
            Utils.toast(e.message || "Ошибка установки пароля", "error");
          }
        }
      };
    } else {
      emailBox.innerText = email || "Email не указан";
      actionBtn.innerText = "Изменить почту";
      passwordInput.style.display = "block";
      Utils.$("security-set-password-section").style.display = "none";
    }

    note.innerText = `Почта подтверждена: ${emailVerified ? "Да" : "Нет"}`;
    emailInput.value = email || "";
    passwordInput.value = "";

    actionBtn.onclick = async () => {
      const btn = Utils.$("btn-security-email-action");
      btn.disabled = true;
      try {
        await this.saveSecurityEmail({
          provider,
          newEmail: emailInput.value.trim(),
          currentPassword: passwordInput.value.trim(),
        });
        await auth.currentUser?.reload();
        await update(ref(db, `users/${AppState.currentUser.uid}/profile`), {
          email: auth.currentUser?.email || emailInput.value.trim(),
          provider,
          emailVerified: Boolean(auth.currentUser?.emailVerified),
        });
        const refreshed =
          AppState.usersCache.get(AppState.currentUser.uid) || {};
        AppState.usersCache.set(AppState.currentUser.uid, {
          ...refreshed,
          email: auth.currentUser?.email || emailInput.value.trim(),
          provider,
          emailVerified: Boolean(auth.currentUser?.emailVerified),
        });
        this.renderSecurityModal();
        Utils.toast("Письмо для подтверждения отправлено на новый email");
      } catch (e) {
        Utils.toast(this.getSecurityEmailErrorText(e), "error");
      } finally {
        btn.disabled = false;
      }
    };
  }

  static getSecurityEmailErrorText(error) {
    const code = String(error?.code || "");
    if (code === "auth/wrong-password") return "Неверный текущий пароль";
    if (code === "auth/invalid-email") return "Некорректный email";
    if (code === "auth/email-already-in-use")
      return "Этот email уже используется";
    if (code === "auth/requires-recent-login")
      return "Повторно войдите в аккаунт и попробуйте снова";
    if (code === "auth/operation-not-allowed")
      return "Смена почты через прямое обновление отключена. Подтвердите новый email по письму";
    return error?.message || "Ошибка обновления почты";
  }

  static async saveSecurityEmail({ provider, newEmail, currentPassword }) {
    const user = auth.currentUser;
    if (!user) throw new Error("Пользователь не авторизован");
    if (!newEmail) throw new Error("Введите email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail))
      throw new Error("Некорректный email");
    if ((user.email || "").toLowerCase() === newEmail.toLowerCase())
      throw new Error("Это уже ваш текущий email");

    if (provider === "email") {
      if (!currentPassword) throw new Error("Введите текущий пароль");
      const credential = EmailAuthProvider.credential(
        user.email || "",
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);
    }

    await verifyBeforeUpdateEmail(user, newEmail);
  }

  static normalizeHexColor(value = "#111111") {
    // [UPDATE]
    const raw = String(value || "").trim(); // [UPDATE]
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase(); // [NEW]
    if (/^#[0-9a-f]{3}$/i.test(raw))
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase(); // [NEW]
    return "#111111"; // [UPDATE]
  } // [UPDATE]

  static hexToRgb(hex = "#111111") {
    // [NEW]
    const safeHex = this.normalizeHexColor(hex).slice(1); // [NEW]
    return {
      // [NEW]
      r: parseInt(safeHex.slice(0, 2), 16), // [NEW]
      g: parseInt(safeHex.slice(2, 4), 16), // [NEW]
      b: parseInt(safeHex.slice(4, 6), 16), // [NEW]
    }; // [NEW]
  } // [NEW]

  static rgbToHex(r = 17, g = 17, b = 17) {
    // [NEW]
    return `#${[r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Number(v) || 0))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`; // [NEW]
  } // [NEW]

  static getReadableProfileColors(hex = "#111111") {
    // [NEW]
    const { r, g, b } = this.hexToRgb(hex); // [NEW]
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // [NEW]
    const isLight = luminance > 0.58; // [NEW]
    return {
      // [NEW]
      text: isLight ? "#111827" : "#ffffff", // [NEW]
      muted: isLight ? "#4b5563" : "rgba(255,255,255,0.76)", // [NEW]
      border: isLight ? "rgba(17,24,39,0.18)" : "rgba(255,255,255,0.22)", // [NEW]
      overlay: isLight ? "rgba(255,255,255,0.76)" : "rgba(0,0,0,0.42)", // [NEW]
    }; // [NEW]
  } // [NEW]

  static normalizeProfileBackground(value = "") {
    // [UPDATE]
    if (value && typeof value === "object") {
      // [NEW]
      const color = this.normalizeHexColor(value.color); // [NEW]
      // [PATCH] Always force to 10 if invalid to keep the base style anchored
      const rawIndex = Number(value.index);
      const index =
        isNaN(rawIndex) || rawIndex <= 0
          ? 1
          : Math.max(1, Math.min(12, rawIndex));
      const url = this.normalizeProfileBackgroundUrl(value.url || ""); // [NEW]
      const dim = typeof value.dim !== "undefined" ? Number(value.dim) : 0.5; // [ADD] Dim logic
      return { color, index, url, dim: Math.max(0, Math.min(1, dim)) }; // [NEW]
    } // [NEW]
    const raw = String(value || "").trim(); // [UPDATE]
    if (!raw) return { color: "#111111", index: 1, url: "", dim: 0.5 }; // [UPDATE]
    if (/data:image/i.test(raw) || /^https?:\/\//i.test(raw))
      return {
        color: "#111111",
        index: 1,
        url: this.normalizeProfileBackgroundUrl(raw),
        dim: 0.5,
      }; // [NEW] Support base64 or http
    return { color: this.normalizeHexColor(raw), index: 1, url: "", dim: 0.5 }; // [UPDATE]
  } // [UPDATE]

  static normalizeProfileBackgroundUrl(value = "") {
    // [NEW]
    const raw = String(value || "").trim(); // [NEW]
    if (!raw) return ""; // [NEW]
    if (raw.startsWith("data:image")) {
      if (raw.length > 5000000) return "";
      return raw;
    }
    if (raw.length > 1024 || /["\\]/.test(raw)) return ""; // [NEW]
    if (!/^https?:\/\//i.test(raw)) return ""; // [NEW]
    try {
      new URL(raw);
      return raw;
    } catch (e) {
      return "";
    } // [NEW]
  } // [NEW]

  static readProfileBackgroundInput() {
    // [UPDATE]
    const r = Number(Utils.$("profile-bg-r")?.value || 31); // [NEW]
    const g = Number(Utils.$("profile-bg-g")?.value || 41); // [NEW]
    const b = Number(Utils.$("profile-bg-b")?.value || 55); // [NEW]
    const urlRaw = Utils.$("profile-bg-url")?.value.trim() || ""; // [NEW]
    const dim = Number(Utils.$("profile-bg-dim")?.value || 0.5); // [ADD]
    const url = this.normalizeProfileBackgroundUrl(urlRaw); // [NEW]
    if (urlRaw && !url && !urlRaw.startsWith("data:image"))
      throw new Error("Фон профиля: некорректный URL/файл"); // [UPDATE]
    return {
      // [UPDATE]
      color: this.rgbToHex(r, g, b), // [NEW]
      index: Number(Utils.$("profile-bg-panel")?.dataset.selectedIndex) || 1, // [PATCH]
      url, // [NEW]
      dim, // [ADD]
    }; // [NEW]
  } // [UPDATE]

  static hydrateProfileBackgroundControls(background = "") {
    // [NEW]
    const data = this.normalizeProfileBackground(background); // [NEW]
    const rgb = this.hexToRgb(data.color); // [NEW]
    this.renderProfileBackgroundPresets(data.index); // [NEW]
    this.setProfileBackgroundRgb(rgb.r, rgb.g, rgb.b, data.index); // [NEW]
    if (Utils.$("profile-bg-url"))
      Utils.$("profile-bg-url").value = data.url || ""; // [NEW]
    if (Utils.$("profile-bg-dim")) Utils.$("profile-bg-dim").value = data.dim; // [ADD]
    if (Utils.$("profile-bg-dim-num"))
      Utils.$("profile-bg-dim-num").value = data.dim; // [ADD]
    this.updateProfileBackgroundPreview(); // [NEW]
  } // [NEW]

  static renderProfileBackgroundPresets(activeIndex = 1) {
    // [NEW]
    const container = Utils.$("profile-bg-presets"); // [NEW]
    if (!container) return; // [NEW]
    container.innerHTML = this.backgroundPresets
      .map((color, idx) => {
        // [NEW]
        const index = idx + 1; // [NEW]
        return `<button type="button" class="profile-bg-preset ${Number(activeIndex) === index ? "active" : ""}" data-index="${index}" data-color="${color}" style="background:${color};">${index}</button>`; // [NEW]
      })
      .join(""); // [NEW]
    container.querySelectorAll(".profile-bg-preset").forEach((btn) => {
      // [NEW]
      btn.onclick = () => {
        // [NEW]
        const rgb = this.hexToRgb(btn.dataset.color); // [NEW]
        this.setProfileBackgroundRgb(rgb.r, rgb.g, rgb.b, btn.dataset.index); // [NEW]
        this.renderProfileBackgroundPresets(btn.dataset.index); // [NEW]
        this.updateProfileBackgroundPreview(); // [NEW]
      }; // [NEW]
    }); // [NEW]
  } // [NEW]

  static setProfileBackgroundRgb(r, g, b, index = 1) {
    // [NEW]
    [
      ["r", r],
      ["g", g],
      ["b", b],
    ].forEach(([key, value]) => {
      // [NEW]
      const safe = Math.max(0, Math.min(255, Number(value) || 0)); // [NEW]
      if (Utils.$(`profile-bg-${key}`))
        Utils.$(`profile-bg-${key}`).value = safe; // [NEW]
      if (Utils.$(`profile-bg-${key}-num`))
        Utils.$(`profile-bg-${key}-num`).value = safe; // [NEW]
    }); // [NEW]
    if (Utils.$("profile-bg-panel"))
      Utils.$("profile-bg-panel").dataset.selectedIndex = String(index || 1); // [PATCH]
  } // [NEW]

  static bindProfileBackgroundControls() {
    // [NEW]
    const panel = Utils.$("profile-bg-panel"); // [NEW]
    const btn = Utils.$("btn-toggle-profile-bg"); // [NEW]
    if (!panel || !btn) return; // [NEW]
    btn.onclick = () => panel.classList.toggle("active"); // [NEW]
    ["r", "g", "b"].forEach((key) => {
      // [NEW]
      const range = Utils.$(`profile-bg-${key}`); // [NEW]
      const number = Utils.$(`profile-bg-${key}-num`); // [NEW]
      const sync = (source, target) => {
        // [NEW]
        const safe = Math.max(0, Math.min(255, Number(source.value) || 0)); // [NEW]
        source.value = safe; // [NEW]
        if (target) target.value = safe; // [NEW]
        if (panel) panel.dataset.selectedIndex = "1"; // [PATCH]
        this.renderProfileBackgroundPresets(1); // [PATCH]
        this.updateProfileBackgroundPreview(); // [NEW]
      }; // [NEW]
      if (range) range.oninput = () => sync(range, number); // [NEW]
      if (number) number.oninput = () => sync(number, range); // [NEW]
    }); // [NEW]
    // [ADD] Bind dim sync
    const dimRange = Utils.$("profile-bg-dim");
    const dimNum = Utils.$("profile-bg-dim-num");
    const syncDim = (s, t) => {
      const val = Math.max(0, Math.min(1, Number(s.value) || 0));
      s.value = val;
      if (t) t.value = val;
      this.updateProfileBackgroundPreview();
    };
    if (dimRange) dimRange.oninput = () => syncDim(dimRange, dimNum);
    if (dimNum) dimNum.oninput = () => syncDim(dimNum, dimRange);

    if (Utils.$("profile-bg-url"))
      Utils.$("profile-bg-url").oninput = Utils.debounce(
        () => this.updateProfileBackgroundPreview(),
        250,
      ); // [NEW]
  } // [NEW]

  static updateProfileBackgroundPreview() {
    // [NEW]
    const preview = Utils.$("profile-bg-preview"); // [NEW]
    if (!preview) return; // [NEW]
    const data = {
      // [UPDATE]
      color: this.rgbToHex(
        Utils.$("profile-bg-r")?.value || 17,
        Utils.$("profile-bg-g")?.value || 17,
        Utils.$("profile-bg-b")?.value || 17,
      ), // [NEW]
      index: Number(Utils.$("profile-bg-panel")?.dataset.selectedIndex) || 1, // [PATCH]
      url: this.normalizeProfileBackgroundUrl(
        Utils.$("profile-bg-url")?.value || "",
      ), // [NEW]
      dim: Number(Utils.$("profile-bg-dim")?.value || 0.5), // [ADD]
    }; // [NEW]
    const colors = this.getReadableProfileColors(data.color); // [NEW]
    preview.style.background = data.color; // [NEW]
    if (data.url) {
      const overlay = `rgba(0,0,0,${data.dim})`;
      preview.style.backgroundImage = `linear-gradient(${overlay}, ${overlay}), url("${data.url.replace(/"/g, "%22")}")`;
      preview.style.backgroundSize = "cover";
      preview.style.backgroundPosition = "center";
    } else {
      preview.style.backgroundImage = "";
    }
    preview.style.color = colors.text; // [NEW]
    preview.style.borderColor = colors.border; // [NEW]
    preview.innerText = `Цвет ${data.index || "RGB"} · ${data.color.toUpperCase()}`; // [NEW]
  } // [NEW]

  static applyProfileBackground(panel, background = "") {
    // Disabled profile backgrounds per user request
    if (panel) {
       panel.style.background = 'transparent';
    }
  }

  static async getPartnerUid(uid) {
    // [NEW]
    if (!uid) return null; // [NEW]
    const snap = await get(ref(db, `users/${uid}/partner`)); // [NEW]
    return snap.exists() ? snap.val() : null; // [NEW]
  } // [NEW]

  static getAvatarHtml(profile = {}) {
    const textFallback = Utils.escapeHtml(
      (profile.name || "?")[0].toUpperCase(),
    );
    let innerHTML = "";
    if (profile.avatar) {
      innerHTML = `<img src="${Utils.escapeHtml(profile.avatar)}" onerror="this.parentElement.innerHTML='?';" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;">`;
    } else {
      innerHTML = textFallback;
    }

    let frameHTML = "";
    if (profile.frame) {
      const frameVal = Utils.escapeHtml(profile.frame);
      if (
        frameVal.includes(".") ||
        frameVal.includes("/") ||
        frameVal.startsWith("http")
      ) {
        // it is an image
        frameHTML = `<img src="${frameVal}" style="width:130%; height:130%; object-fit:contain; position:absolute; top:-15%; left:-15%; z-index:2; pointer-events:none;">`;
      } else {
        // it is a CSS class
        frameHTML = `<div class="${frameVal}" style="z-index:2; pointer-events:none;"></div>`;
      }
    }

    return `<div class="avatar-inner-wrap" style="position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; border-radius:inherit;"><div style="position:absolute; inset:0; width:100%; height:100%; overflow:hidden; border-radius:inherit; display:flex; align-items:center; justify-content:center; font-size:inherit; font-weight:inherit; color:inherit; background:transparent;">${innerHTML}</div>${frameHTML}</div>`;
  } // [NEW]

  static async renderPartnerContainer(
    containerId,
    partnerUid,
    canRemove = false,
    ownerUid = null,
  ) {
    // [UPDATE]
    const container = Utils.$(containerId); // [NEW]
    if (!container) return; // [NEW]
    container.classList.remove("active"); // [NEW]
    container.innerHTML = ""; // [NEW]
    if (!partnerUid) {
      container.onclick = null; // [PATCH]
      container.style.cursor = "default";
      return;
    } // [NEW]
    const partnerProfile = await this.loadUser(partnerUid); // [NEW]
    if (!partnerProfile) return; // [NEW]
    const sinceSnap = ownerUid
      ? await get(ref(db, `users/${ownerUid}/partnerSince`))
      : null; // [NEW]
    const sinceTs = sinceSnap?.exists() ? Number(sinceSnap.val()) : 0; // [NEW]
    const sinceText = sinceTs
      ? new Date(sinceTs).toLocaleDateString()
      : "дата не указана"; // [NEW]
    const daysText = sinceTs
      ? Math.max(1, Math.ceil((Date.now() - sinceTs) / 86400000))
      : 0; // [NEW]
    let bondMeta = "";
    if (ownerUid && !String(partnerUid).startsWith("custom_partner_")) {
      const bond = await PartnerBondEngine.getBond(ownerUid, partnerUid);
      const lvl = PartnerBondEngine.bondLevel(bond.totalWarmth);
      bondMeta = ` · ур. ${lvl}${bond.streak && bond.streak > 1 ? ` · <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;">${bond.streak}` : ""}`;
    }
    container.innerHTML = `
            <div class="partner-avatar">${this.getAvatarHtml(partnerProfile)}</div>
            <div class="partner-info">
                <div class="partner-label">Вторая половинка</div>
                <div class="partner-name">${Utils.escapeHtml(partnerProfile.name || "Пользователь")}</div>
                <div class="partner-meta">${sinceTs ? `Вместе ${daysText} дн.${bondMeta}` : `Пара подтверждена${bondMeta}`}</div>
            </div>
            ${canRemove ? '<button class="danger-btn btn-remove-current-partner" style="width:auto; padding:8px 10px; z-index:10; position:relative;">Убрать</button>' : ""}
        `; // [NEW]
    container.classList.add("active"); // [NEW]

    // [ADD] Click to open sweet modal
    container.style.cursor = "pointer";
    container.onclick = (e) => {
      if (!e.target.closest("button")) {
        this.openPartnerModal(ownerUid || partnerUid, partnerUid);
      }
    };

    const removeBtn = container.querySelector(".btn-remove-current-partner"); // [NEW]
    if (removeBtn)
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.removePartner(partnerUid);
      }; // [NEW]
  } // [NEW]

  static async openPartnerModal(ownerUid, partnerUid) {
    const myProf = await this.loadUser(ownerUid);
    const theirProf = await this.loadUser(partnerUid);
    if (!myProf || !theirProf) return;

    const sinceSnap = await get(ref(db, `users/${ownerUid}/partnerSince`));
    const sinceTs = sinceSnap?.exists() ? Number(sinceSnap.val()) : 0;
    await PartnerRelationshipPanel.open(
      ownerUid,
      partnerUid,
      myProf,
      theirProf,
      sinceTs,
    );
  }

  static async renderMyPartnerBox() {
    // [NEW]
    const partnerUid = await this.getPartnerUid(AppState.currentUser?.uid); // [NEW]
    await this.renderPartnerContainer(
      "edit-partner-container",
      partnerUid,
      true,
      AppState.currentUser?.uid,
    ); // [UPDATE]
  } // [NEW]

  static async renderLoveRequests() {
    // [NEW]
    const container = Utils.$("my-love-requests"); // [NEW]
    if (!container || !AppState.currentUser) return; // [NEW]
    const snap = await get(
      ref(db, `users/${AppState.currentUser.uid}/loveRequests`),
    ); // [NEW]
    const requests = snap.val() || {}; // [NEW]
    const requestUids = Object.keys(requests); // [NEW]
    container.classList.remove("active"); // [NEW]
    container.innerHTML = ""; // [NEW]
    if (!requestUids.length) return; // [NEW]
    const html = []; // [NEW]
    for (const uid of requestUids) {
      // [NEW]
      const profile = await this.loadUser(uid); // [NEW]
      if (!profile) continue; // [NEW]
      // [NEW]
      html.push(`
                <div class="love-request-item" data-uid="${Utils.escapeHtml(uid)}">
                    <span>${Utils.escapeHtml(profile.name || "Пользователь")} предлагает стать второй половинкой</span>
                    <div class="love-request-actions">
                        <button class="btn-small btn-accept-love">Принять</button>
                        <button class="btn-small btn-decline-love">Отклонить</button>
                    </div>
                </div>
            `); // [NEW]
    } // [NEW]
    if (!html.length) return; // [NEW]
    container.innerHTML = html.join(""); // [NEW]
    container.classList.add("active"); // [NEW]
    container.querySelectorAll(".btn-accept-love").forEach((btn) => {
      // [NEW]
      btn.onclick = () =>
        this.handleLoveRequest(
          btn.closest(".love-request-item")?.dataset.uid,
          true,
        ); // [NEW]
    }); // [NEW]
    container.querySelectorAll(".btn-decline-love").forEach((btn) => {
      // [NEW]
      btn.onclick = () =>
        this.handleLoveRequest(
          btn.closest(".love-request-item")?.dataset.uid,
          false,
        ); // [NEW]
    }); // [NEW]
  } // [NEW]

  static async sendLoveRequest(targetUid) {
    // [NEW]
    const myUid = AppState.currentUser?.uid; // [NEW]
    if (!myUid || !targetUid || targetUid === myUid) return; // [NEW]

    const myProfile =
      AppState.usersCache.get(myUid) || (await this.loadUser(myUid)) || {};
    const targetProfile =
      AppState.usersCache.get(targetUid) ||
      (await this.loadUser(targetUid)) ||
      {};
    const myGender = myProfile.gender || "male";
    const targetGender = targetProfile.gender || "male";
    if (myGender === targetGender) {
      return Utils.toast("Однополые браки запрещены", "error");
    }

    const friendSnap = await get(
      ref(db, `users/${myUid}/friends/${targetUid}`),
    ); // [NEW]
    if (!friendSnap.exists() || friendSnap.val().status !== "accepted")
      return Utils.toast("Предложение доступно только друзьям", "error"); // [NEW]
    const [myPartnerSnap, targetPartnerSnap] = await Promise.all([
      // [NEW]
      get(ref(db, `users/${myUid}/partner`)), // [NEW]
      get(ref(db, `users/${targetUid}/partner`)), // [NEW]
    ]); // [NEW]
    if (myPartnerSnap.exists() || targetPartnerSnap.exists())
      return Utils.toast("У кого-то уже есть вторая половинка", "error"); // [NEW]
    await set(ref(db, `users/${targetUid}/loveRequests/${myUid}`), {
      ts: Date.now(),
    }); // [NEW]
    Utils.toast("Предложение отправлено"); // [NEW]
  } // [NEW]

  static async handleLoveRequest(partnerUid, accept) {
    // [NEW]
    const myUid = AppState.currentUser?.uid; // [NEW]
    if (!myUid || !partnerUid) return; // [NEW]
    const updates = {}; // [NEW]
    let partnerSince = Date.now(); // [NEW]
    if (accept) {
      // [NEW]
      const friendSnap = await get(
        ref(db, `users/${myUid}/friends/${partnerUid}`),
      ); // [NEW]
      if (!friendSnap.exists() || friendSnap.val().status !== "accepted")
        return Utils.toast("Вторая половинка доступна только друзьям", "error"); // [NEW]
      const [myPartnerSnap, targetPartnerSnap] = await Promise.all([
        // [NEW]
        get(ref(db, `users/${myUid}/partner`)), // [NEW]
        get(ref(db, `users/${partnerUid}/partner`)), // [NEW]
      ]); // [NEW]
      if (myPartnerSnap.exists() || targetPartnerSnap.exists()) {
        // [NEW]
        await remove(ref(db, `users/${myUid}/loveRequests/${partnerUid}`)); // [NEW]
        await this.renderLoveRequests(); // [NEW]
        return Utils.toast("У кого-то уже есть вторая половинка", "error"); // [NEW]
      } // [NEW]
      partnerSince = Date.now(); // [NEW]
      updates[`users/${myUid}/partner`] = partnerUid; // [NEW]
      updates[`users/${partnerUid}/partner`] = myUid; // [NEW]
      updates[`users/${myUid}/partnerSince`] = partnerSince; // [NEW]
      updates[`users/${partnerUid}/partnerSince`] = partnerSince; // [NEW]
    } // [NEW]
    updates[`users/${myUid}/loveRequests/${partnerUid}`] = null; // [NEW]
    await update(ref(db), updates); // [NEW]
    if (accept)
      await PartnerBondEngine.onUnion(myUid, partnerUid, partnerSince); // [NEW]
    Utils.toast(
      accept ? "Вторая половинка добавлена" : "Предложение отклонено",
    ); // [NEW]
    await this.renderMyPartnerBox(); // [NEW]
    await this.renderLoveRequests(); // [NEW]
  } // [NEW]

  static async removePartner(partnerUid = null) {
    // [NEW]
    const myUid = AppState.currentUser?.uid; // [NEW]
    if (!myUid) return; // [NEW]
    const currentPartnerUid = partnerUid || (await this.getPartnerUid(myUid)); // [NEW]
    if (!currentPartnerUid) return; // [NEW]
    const updates = {}; // [NEW]
    updates[`users/${myUid}/partner`] = null; // [NEW]
    updates[`users/${currentPartnerUid}/partner`] = null; // [NEW]
    updates[`users/${myUid}/partnerSince`] = null; // [NEW]
    updates[`users/${currentPartnerUid}/partnerSince`] = null; // [NEW]
    await update(ref(db), updates); // [NEW]
    Utils.toast("Вторая половинка удалена"); // [NEW]
    await this.renderMyPartnerBox(); // [NEW]
    await this.renderPartnerContainer(
      "view-partner-container",
      null,
      false,
      myUid,
    ); // [UPDATE]
    const removeBtn = Utils.$("btn-remove-partner"); // [NEW]
    if (removeBtn) removeBtn.style.display = "none"; // [NEW]
  } // [NEW]

  static async updateLoveProfileActions(targetUid, isFriend = false) {
    // [NEW]
        const removeBtn = Utils.$("btn-remove-partner"); // [NEW]
    const myUid = AppState.currentUser?.uid; // [NEW]
    if (!loveBtn || !removeBtn || !myUid) return; // [NEW]
    loveBtn.style.display = "none"; // [NEW]
    removeBtn.style.display = "none"; // [NEW]
    loveBtn.disabled = false; // [NEW]
    if (!targetUid || targetUid === myUid) return; // [NEW]
    const [myPartnerSnap, targetPartnerSnap, outgoingSnap, incomingSnap] =
      await Promise.all([
        // [NEW]
        get(ref(db, `users/${myUid}/partner`)), // [NEW]
        get(ref(db, `users/${targetUid}/partner`)), // [NEW]
        get(ref(db, `users/${targetUid}/loveRequests/${myUid}`)), // [NEW]
        get(ref(db, `users/${myUid}/loveRequests/${targetUid}`)), // [NEW]
      ]); // [NEW]
    const myPartnerUid = myPartnerSnap.exists() ? myPartnerSnap.val() : null; // [NEW]
    const targetPartnerUid = targetPartnerSnap.exists()
      ? targetPartnerSnap.val()
      : null; // [NEW]
    if (myPartnerUid === targetUid) {
      // [NEW]
      removeBtn.style.display = "block"; // [NEW]
      removeBtn.onclick = () => this.removePartner(targetUid); // [NEW]
      return; // [NEW]
    } // [NEW]
    if (!isFriend || myPartnerUid || targetPartnerUid) return; // [NEW]
    loveBtn.style.display = "block"; // [NEW]
    if (incomingSnap.exists()) {
      // [NEW]
      loveBtn.innerText = "Принять предложение"; // [NEW]
      loveBtn.onclick = async () => {
        await this.handleLoveRequest(targetUid, true);
        await this.updateLoveProfileActions(targetUid, isFriend);
      }; // [UPDATE]
      return; // [NEW]
    } // [NEW]
    loveBtn.innerText = outgoingSnap.exists()
      ? "Предложение отправлено"
      : "Предложить стать второй половинкой"; // [NEW]
    loveBtn.disabled = outgoingSnap.exists(); // [NEW]
    loveBtn.onclick = async () => {
      await this.sendLoveRequest(targetUid);
      await this.updateLoveProfileActions(targetUid, isFriend);
    }; // [NEW]
  } // [NEW]

  static updateAvatarPreview(url, name) {
    const prev = Utils.$("edit-avatar-preview");
    if (url) {
      prev.innerHTML = `<img src="${Utils.escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.innerHTML='?'">`;
    } else {
      prev.innerHTML = (name || "?")[0].toUpperCase();
    }
  }

  static async saveProfile() {
    if (
      !SecurityManager.validateAction("profile_update", {
        count: 5,
        timeWindowMs: 60000,
      })
    )
      return;
    const uid = AppState.currentUser.uid;
    const oldProfile = AppState.usersCache.get(uid);
    const name = Utils.$("edit-name").value.trim();
    let username = Utils.$("edit-username-input")
      .value.toLowerCase()
      .trim()
      .replace("@", "");
    const bio = Utils.$("edit-bio").value.trim();
    const bioLimit = window.PremiumManager
      ? PremiumManager.getBioLimit(oldProfile, uid)
      : 200;
    if (bio.length > bioLimit) {
      throw new Error(`Био слишком длинное (макс. ${bioLimit} символов)`);
    }
    const hashtags = HashtagManager.parseHashtags(
      Utils.$("edit-hashtags").value,
      false,
    );
    const avatar = Utils.$("edit-avatar-url").value.trim();
    const bannerUrl = Utils.$("edit-banner-url") ? Utils.$("edit-banner-url").value.trim() : "";
    const bannerDimming = Utils.$("edit-banner-dimming") ? parseInt(Utils.$("edit-banner-dimming").value, 10) : 30;
    const bannerPositionY = Utils.$("edit-banner-pos") ? parseInt(Utils.$("edit-banner-pos").value, 10) : 50;
    const gender =
      document.querySelector('input[name="edit-gender"]:checked')?.value ||
      "male";

    // extra username
    const level = Math.floor(Math.sqrt((oldProfile?.xp || 0) / 240));
    let newExtraUsernames = [];
    const _validateExtra = (inputId, minLvl, num) => {
      if (level < minLvl) return;
      const xInput = Utils.$(inputId);
      if (!xInput) return;
      const xUname = xInput.value.toLowerCase().trim().replace("@", "");
      if (!xUname) return;
      if (!/^[a-z0-9_]{3,15}$/.test(xUname))
        throw new Error(`Доп. ID ${num}: 3-15 символов, a-z, 0-9, _`);
      if (
        xUname === username ||
        xUname === "developer" ||
        newExtraUsernames.includes(xUname)
      )
        throw new Error(`Доп. ID ${num}: Недопустимый ID`);
      newExtraUsernames.push(xUname);
    };
    _validateExtra("edit-extra-username-input-1", 30, 1);
    _validateExtra("edit-extra-username-input-2", 50, 2);
    _validateExtra("edit-extra-username-input-3", 100, 3);
    const frame = Utils.$("modal-edit-profile").dataset.selectedFrame || null;

    if (!name || !username) throw new Error("Имя и ID обязательны");
    if (!/^[a-z0-9_]{3,15}$/.test(username))
      throw new Error("ID: 3-15 символов, a-z, 0-9, _");
    if (username === "developer" && oldProfile.username !== "developer")
      throw new Error("ID developer зарезервирован!");

    const developerUid = await AdminPanel.getDeveloperUid();
    const isCreatorProfile = Boolean(
      (developerUid && uid === developerUid) ||
      AdminPanel.isValidCreatorProfile(oldProfile),
    );

    if (isCreatorProfile && username !== oldProfile.username)
      throw new Error("ID Создателя нельзя изменить");

    const updates = {};

    if (username !== oldProfile.username) {
      const snap = await get(ref(db, `usernames/${username}`));
      if (snap.exists() && snap.val() !== uid)
        throw new Error("Этот ID уже занят");

      if (oldProfile.username)
        updates[`usernames/${oldProfile.username}`] = null;
      updates[`usernames/${username}`] = uid;
    }

    if (newExtraUsernames.length > 0) {
      for (let eu of newExtraUsernames) {
        const snapExt = await get(ref(db, `usernames/${eu}`));
        if (snapExt.exists() && snapExt.val() !== uid)
          throw new Error(`ID ${eu} уже занят`);
      }
    }

    if (oldProfile.extraUsernames) {
      oldProfile.extraUsernames.forEach((eu) => {
        if (eu && !newExtraUsernames.includes(eu)) {
          updates[`usernames/${eu}`] = null;
        }
      });
    }

    newExtraUsernames.forEach((eu) => {
      updates[`usernames/${eu}`] = uid;
    });

    const nextProfile = {
      ...oldProfile,
      name,
      username,
      extraUsernames: newExtraUsernames,
      bio,
      hashtags,
      avatar,
      gender,
      frame,
      bannerUrl,
      bannerDimming,
      bannerPositionY,
    };
    updates[`users/${uid}/profile`] = nextProfile; // [UPDATE]
    await update(ref(db), updates);

    // Update local cache immediately
    AppState.usersCache.set(uid, nextProfile);

    // Live update profile UI instantly without requiring a page refresh
    const sProfile = document.getElementById("section-profile");
    if (sProfile) {
      ProfileManager.applyProfileBanner(sProfile, nextProfile);

      if (Utils.$("view-name")) {
        Utils.$("view-name").innerHTML = `${window.PremiumManager ? PremiumManager.getStatusEmojiHtml(nextProfile, uid) : ""}${Utils.escapeHtml(name)}`;
      }
      if (Utils.$("view-username")) {
        Utils.$("view-username").innerHTML = `@${Utils.escapeHtml(username)}`;
      }
      if (Utils.$("view-avatar")) {
        Utils.$("view-avatar").innerHTML = ProfileManager.getAvatarHtml(nextProfile);
      }
      if (Utils.$("view-gender")) {
        Utils.$("view-gender").innerHTML = `${gender === "female" ? "♀ Женский" : "♂ Мужской"}`;
      }
    }

    if (uid === AppState.currentUser?.uid) {
      await updateProfile(AppState.currentUser, {
        displayName: name,
        photoURL: avatar,
      }).catch((e) => console.warn("Failed to update auth profile", e));
    }
  }

  static getExpMath(totalXp) {
    if (typeof totalXp !== "number" || isNaN(totalXp) || totalXp < 0) {
      return { level: 0, current: totalXp || 0, needed: 240, percent: 0 };
    }
    const level = Math.floor(Math.sqrt(totalXp / 240));
    const xpAtCurrentLevel = 240 * (level * level);
    const xpAtNextLevel = 240 * ((level + 1) * (level + 1));

    const current = totalXp - xpAtCurrentLevel;
    const needed = xpAtNextLevel - xpAtCurrentLevel;
    const percent = Math.max(
      0,
      Math.min(100, Math.floor((current / needed) * 100)),
    );

    return { level, current, needed, percent };
  }

  static async loadUser(uid) {
    // If we want up-to-date avatar/frame, it might be better to skip cache, but let's keep it
    if (AppState.usersCache.has(uid)) return AppState.usersCache.get(uid);
    try {
      const snap = await get(ref(db, `users/${uid}`));
      if (!snap.exists()) return { name: "Unknown", username: "unknown" };
      const node = snap.val();
      const data = node.profile || { name: "Unknown", username: "unknown" };

      const eqFrame = node.equippedFrame;
      if (
        eqFrame &&
        AppState.catalog &&
        AppState.catalog.frames &&
        AppState.catalog.frames[eqFrame]
      ) {
        data.frame = AppState.catalog.frames[eqFrame].url || eqFrame;
      }
      AppState.usersCache.set(uid, data);
      return data;
    } catch (e) {
      return null;
    }
  }

  static async openProfileModal(uid) {
    return this.openViewProfileModal(uid);
  }

  static getActiveStreak(profile) {
    if (!profile || !profile.lastLoginDate) return 0;
    let streak = Number(profile.streak || 0);
    if (streak < 2) return 0;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;

    if (
      profile.lastLoginDate !== todayStr &&
      profile.lastLoginDate !== yesterdayStr
    ) {
      return 0; // Streak broken!
    }
    return streak;
  }

  static closeProfileOverlay() {
    if (this.viewUnsubs) {
      this.viewUnsubs.forEach((f) => { try { f(); } catch (e) {} });
      this.viewUnsubs = [];
    }
    this._currentlyOpenUid = null;
    this._currentlyOpenUsername = null;
    const sProfile = document.getElementById("section-profile");
    const backdrop = document.getElementById("profile-overlay-backdrop");
    if (backdrop) backdrop.style.display = "none";
    if (sProfile) {
      sProfile.style.display = "none";
      if (sProfile.__originalParent) {
        sProfile.__originalParent.insertBefore(sProfile, sProfile.__originalSibling);
        sProfile.__originalParent = null;
        sProfile.__originalSibling = null;
      }
      sProfile.style.position = "relative";
      sProfile.style.top = "auto";
      sProfile.style.left = "auto";
      sProfile.style.transform = "none";
      sProfile.style.width = "100%";
      sProfile.style.maxWidth = "none";
      sProfile.style.maxHeight = "none";
      sProfile.style.height = "100%";
      sProfile.style.aspectRatio = "unset";
      sProfile.style.zIndex = "1";
      sProfile.style.background = "transparent";
      sProfile.style.borderRadius = "0";
      sProfile.style.boxShadow = "none";
      sProfile.style.border = "none";
      sProfile.style.backdropFilter = "none";
      const closeBtn = document.getElementById("profile-overlay-close");
      if (closeBtn) closeBtn.style.display = "none";
    }
  }

  static async giftLumens(targetUid, targetProfile) {
    const currentUid = AppState.currentUser?.uid;
    if (!currentUid) return Utils.toast("Авторизуйтесь, чтобы дарить Люмены", "error");
    if (currentUid === targetUid) return Utils.toast("Вы не можете подарить Люмены самому себе", "warn");

    // Friends-only constraint
    const isFriend = await FriendsManager.isFriendWith(targetUid);
    if (!isFriend) {
      return Utils.toast("Дарить Люмены можно только друзьям! Сначала добавьте пользователя в друзья.", "warn");
    }

    const myProf = AppState.usersCache.get(currentUid) || {};
    const myLumens = Number(myProf.lumens) || 0;
    if (myLumens <= 0) {
      return Utils.toast("У вас 0 Люменов. Смотрите видео в комнатах, чтобы заработать!", "warn");
    }

    try {
      const { update, ref, getDatabase, get } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
      const dbInstance = getDatabase();

      // Daily limit per recipient: up to 100 Lumens per day to a specific user
      const todayKey = new Date().toISOString().slice(0, 10);
      const recipientDailySnap = await get(ref(dbInstance, `users/${currentUid}/dailyGiftTo/${targetUid}/${todayKey}`));
      const giftedToThisUserToday = Number(recipientDailySnap.val()) || 0;
      const remainingDaily = Math.max(0, 100 - giftedToThisUserToday);

      if (remainingDaily <= 0) {
        return Utils.toast("Вы исчерпали суточный лимит подарков для этого пользователя (100 Люменов в сутки). Приходите завтра!", "warn");
      }

      const targetName = targetProfile.name || targetProfile.username || "Другу";
      const targetUsername = targetProfile.username ? `@${targetProfile.username}` : "";
      const maxAllowed = Math.min(remainingDaily, myLumens);

      const modal = Utils.$("modal-gift-lumens");
      if (!modal) {
        return Utils.toast("Ошибка интерфейса подарков", "error");
      }

      // Populate Target Friend Info
      const avatarEl = Utils.$("gift-target-avatar-preview");
      if (avatarEl) {
        avatarEl.innerHTML = ProfileManager.getAvatarHtml(targetProfile);
      }
      const nameEl = Utils.$("gift-target-name-preview");
      if (nameEl) nameEl.textContent = targetName;
      const unameEl = Utils.$("gift-target-username-preview");
      if (unameEl) unameEl.textContent = targetUsername || `@id${targetUid.slice(0, 6)}`;

      // Populate Balances
      const myLumensEl = Utils.$("gift-modal-my-lumens");
      if (myLumensEl) myLumensEl.textContent = myLumens.toLocaleString();

      const remLimitEl = Utils.$("gift-modal-remaining-limit");
      if (remLimitEl) remLimitEl.textContent = remainingDaily;

      const inputEl = Utils.$("gift-lumens-amount-input");
      const afterBalEl = Utils.$("gift-modal-after-balance");
      const btnAmountEl = Utils.$("gift-modal-btn-amount");
      const errorMsgEl = Utils.$("gift-modal-error-msg");
      const noteInputEl = Utils.$("gift-lumens-note-input");
      const submitBtn = Utils.$("btn-submit-gift-lumens");

      if (noteInputEl) noteInputEl.value = "";
      if (errorMsgEl) {
        errorMsgEl.style.display = "none";
        errorMsgEl.textContent = "";
      }

      let currentVal = Math.min(maxAllowed, 5);
      if (currentVal < 1) currentVal = 1;

      const updateUI = (val) => {
        val = parseInt(val, 10);
        if (isNaN(val)) val = 1;

        let err = null;
        if (val <= 0) {
          err = "Минимум 1 Люмен";
        } else if (val > myLumens) {
          err = `Недостаточно Люменов (баланс: ${myLumens})`;
        } else if (val > remainingDaily) {
          err = `Превышен суточный лимит (${remainingDaily} из 100)`;
        }

        if (err) {
          if (errorMsgEl) {
            errorMsgEl.style.display = "inline";
            errorMsgEl.textContent = err;
          }
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.5";
            submitBtn.style.cursor = "not-allowed";
          }
        } else {
          if (errorMsgEl) {
            errorMsgEl.style.display = "none";
            errorMsgEl.textContent = "";
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
          }
        }

        if (inputEl) inputEl.value = val;
        if (btnAmountEl) btnAmountEl.textContent = val;
        if (afterBalEl) {
          const after = Math.max(0, myLumens - (isNaN(val) ? 0 : val));
          afterBalEl.textContent = after.toLocaleString();
        }

        // Active preset buttons
        document.querySelectorAll(".gift-preset-btn").forEach((btn) => {
          const preset = btn.dataset.amount;
          if (preset === "max" && val === maxAllowed) {
            btn.classList.add("active");
          } else if (parseInt(preset, 10) === val) {
            btn.classList.add("active");
          } else {
            btn.classList.remove("active");
          }
        });
      };

      updateUI(currentVal);

      // Wire preset buttons
      document.querySelectorAll(".gift-preset-btn").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          const p = btn.dataset.amount;
          if (p === "max") {
            currentVal = maxAllowed;
          } else {
            currentVal = Math.min(maxAllowed, parseInt(p, 10) || 5);
          }
          updateUI(currentVal);
        };
      });

      // Stepper
      const btnMinus = Utils.$("gift-lumens-btn-minus");
      if (btnMinus) {
        btnMinus.onclick = () => {
          currentVal = Math.max(1, (parseInt(inputEl?.value, 10) || 1) - 1);
          updateUI(currentVal);
        };
      }
      const btnPlus = Utils.$("gift-lumens-btn-plus");
      if (btnPlus) {
        btnPlus.onclick = () => {
          currentVal = Math.min(maxAllowed, (parseInt(inputEl?.value, 10) || 1) + 1);
          updateUI(currentVal);
        };
      }

      if (inputEl) {
        inputEl.oninput = () => {
          currentVal = parseInt(inputEl.value, 10);
          updateUI(currentVal);
        };
      }

      // Close handlers
      const closeModal = () => {
        modal.classList.remove("active");
      };

      const closeBtn = Utils.$("btn-close-gift-lumens-modal");
      if (closeBtn) closeBtn.onclick = closeModal;
      const cancelBtn = Utils.$("btn-cancel-gift-lumens");
      if (cancelBtn) cancelBtn.onclick = closeModal;

      // Submit handler
      if (submitBtn) {
        submitBtn.onclick = async () => {
          const finalAmount = parseInt(inputEl?.value, 10);
          if (isNaN(finalAmount) || finalAmount <= 0) {
            return Utils.toast("Укажите корректное количество Люменов", "error");
          }
          if (finalAmount > myLumens) {
            return Utils.toast(`Недостаточно Люменов! Доступно: ${myLumens.toLocaleString()}`, "error");
          }
          if (finalAmount > remainingDaily) {
            return Utils.toast(`Превышен суточный лимит! Сегодня вы можете подарить этому пользователю максимум ${remainingDaily} Люменов (лимит 100 в сутки).`, "warn");
          }

          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Отправка...</span>`;

          try {
            const targetSnap = await get(ref(dbInstance, `users/${targetUid}/profile`));
            const targetData = targetSnap.val() || {};
            const targetLumens = Number(targetData.lumens) || 0;

            const newMyLumens = myLumens - finalAmount;
            const newTargetLumens = targetLumens + finalAmount;

            const noteVal = noteInputEl?.value?.trim() || "";

            // Daily gift tracking per user and legacy daily total
            const legacyDailySnap = await get(ref(dbInstance, `users/${currentUid}/dailyGiftLumens/${todayKey}`));
            const legacyGiftedToday = Number(legacyDailySnap.val()) || 0;

            await update(ref(dbInstance), {
              [`users/${currentUid}/profile/lumens`]: newMyLumens,
              [`users/${targetUid}/profile/lumens`]: newTargetLumens,
              [`users/${currentUid}/dailyGiftTo/${targetUid}/${todayKey}`]: giftedToThisUserToday + finalAmount,
              [`users/${currentUid}/dailyGiftLumens/${todayKey}`]: legacyGiftedToday + finalAmount
            });

            myProf.lumens = newMyLumens;
            AppState.usersCache.set(currentUid, myProf);
            targetProfile.lumens = newTargetLumens;
            AppState.usersCache.set(targetUid, targetProfile);

            if (window.LumenManager) {
              const noteFormatted = noteVal ? ` («${noteVal}»)` : "";
              LumenManager.updateBalance(newMyLumens, {
                diff: -finalAmount,
                reason: `Подарок для ${targetName}${noteFormatted}`,
                source: "gift",
                animate: true,
                showFloater: true,
                saveTx: true,
                txType: "expense",
                txIcon: "gift"
              });
              LumenManager.recordTransaction(targetUid, {
                type: "income",
                amount: finalAmount,
                reason: `Подарок от @${myProf.username || "друга"}${noteFormatted}`,
                icon: "gift"
              });
            } else {
              const hp = Utils.$("header-lumens-count");
              if (hp) hp.textContent = newMyLumens.toLocaleString();
              const myL = Utils.$("my-lumens-val");
              if (myL) myL.textContent = newMyLumens.toLocaleString();
            }
            const vlc = Utils.$("view-lumens-count");
            if (vlc) vlc.textContent = newTargetLumens.toLocaleString();

            closeModal();
            const newRemaining = remainingDaily - finalAmount;
            Utils.toast(`Вы подарили ${finalAmount} Люменов другу ${targetName}! (Остаток суточного лимита для него: ${newRemaining})`, "success");
          } catch (err) {
            console.error(err);
            Utils.toast("Ошибка при отправке подарка", "error");
          } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Подарить</span> <span id="gift-modal-btn-amount">${finalAmount}</span> <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Activity/Sparkles.webp" style="width: 18px; height: 18px; object-fit: contain;" alt="✨">`;
          }
        };
      }

      modal.classList.add("active");
    } catch (err) {
      console.error(err);
      Utils.toast("Ошибка при подготовке подарка", "error");
    }
  }

  static async openViewProfileModal(targetUid, forceOverlay = false) {
    if (!targetUid) return;
    if (!this._profileReqCounter) this._profileReqCounter = 0;
    const thisReqId = ++this._profileReqCounter;
    this._currentlyOpenUid = targetUid;

    // Immediately stop listening to previous profile to prevent stale updates/sticking
    if (this.viewUnsubs) {
      this.viewUnsubs.forEach((f) => { try { f(); } catch (e) {} });
      this.viewUnsubs = [];
    } else {
      this.viewUnsubs = [];
    }

    const sProfile = document.getElementById("section-profile");
    if (!sProfile) return;
    const vModal = sProfile;

    const isRoom = forceOverlay || document.getElementById("room-screen")?.classList.contains("active");

    if (isRoom) {
       // Save original location in lobby DOM
       if (!sProfile.__originalParent && sProfile.parentElement !== document.body) {
         sProfile.__originalParent = sProfile.parentElement;
         sProfile.__originalSibling = sProfile.nextSibling;
       }
       // Move out of hidden #lobby-screen directly into body
       if (sProfile.parentElement !== document.body) {
         document.body.appendChild(sProfile);
       }

       let backdrop = document.getElementById("profile-overlay-backdrop");
       if (!backdrop) {
         backdrop = document.createElement("div");
         backdrop.id = "profile-overlay-backdrop";
         backdrop.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99998; display: block;";
         backdrop.onclick = () => ProfileManager.closeProfileOverlay();
         document.body.appendChild(backdrop);
       } else {
         backdrop.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 99998; display: block;";
       }

       if (!window._profileOverlayEscapeBound) {
         window._profileOverlayEscapeBound = true;
         window.addEventListener("keydown", (e) => {
           if (e.key === "Escape") {
             ProfileManager.closeProfileOverlay();
           }
         });
       }

       // Make it a horizontal (16:9 widescreen) modal overlay with translucent frosted glass blur
       sProfile.style.setProperty("position", "fixed", "important");
       sProfile.style.setProperty("top", "50%", "important");
       sProfile.style.setProperty("left", "50%", "important");
       sProfile.style.setProperty("transform", "translate(-50%, -50%)", "important");
       sProfile.style.setProperty("width", "min(94vw, 940px)", "important");
       sProfile.style.setProperty("max-width", "940px", "important");
       sProfile.style.setProperty("aspect-ratio", "16 / 9", "important");
       sProfile.style.setProperty("max-height", "88vh", "important");
       sProfile.style.setProperty("height", "auto", "important");
       sProfile.style.setProperty("overflow-y", "auto", "important");
       sProfile.style.setProperty("overflow-x", "hidden", "important");
       sProfile.style.setProperty("z-index", "99999", "important");
       sProfile.style.setProperty("background", "rgba(10, 10, 14, 0.45)", "important");
       sProfile.style.setProperty("border-radius", "20px", "important");
       sProfile.style.setProperty("box-shadow", "0 25px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.14) inset", "important");
       sProfile.style.setProperty("border", "1px solid rgba(255,255,255,0.15)", "important");
       sProfile.style.setProperty("backdrop-filter", "blur(24px) saturate(180%)", "important");
       sProfile.style.setProperty("-webkit-backdrop-filter", "blur(24px) saturate(180%)", "important");
       sProfile.style.display = "flex";
       sProfile.style.flexDirection = "column";
       
       if (!document.getElementById("profile-overlay-close")) {
           const btn = document.createElement("button");
           btn.id = "profile-overlay-close";
           btn.innerHTML = "✖";
           btn.title = "Закрыть профиль";
           btn.style.cssText = "position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.25); color: white; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; z-index: 100000; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s, transform 0.2s;";
           btn.onmouseover = () => { btn.style.background = "rgba(0,0,0,0.85)"; btn.style.transform = "scale(1.05)"; };
           btn.onmouseout = () => { btn.style.background = "rgba(0,0,0,0.65)"; btn.style.transform = "scale(1)"; };
           btn.onclick = () => {
               ProfileManager.closeProfileOverlay();
           };
           sProfile.appendChild(btn);
       } else {
           document.getElementById("profile-overlay-close").style.display = "flex";
       }
    } else {
        // Normal lobby behavior
        if (sProfile.__originalParent && sProfile.parentElement === document.body) {
          sProfile.__originalParent.insertBefore(sProfile, sProfile.__originalSibling);
          sProfile.__originalParent = null;
          sProfile.__originalSibling = null;
        }
        const backdrop = document.getElementById("profile-overlay-backdrop");
        if (backdrop) backdrop.style.display = "none";
        sProfile.style.position = "relative";
        sProfile.style.top = "auto";
        sProfile.style.left = "auto";
        sProfile.style.transform = "none";
        sProfile.style.width = "100%";
        sProfile.style.maxWidth = "none";
        sProfile.style.maxHeight = "none";
        sProfile.style.height = "100%";
        sProfile.style.zIndex = "1";
        sProfile.style.background = "transparent";
        sProfile.style.borderRadius = "0";
        sProfile.style.boxShadow = "none";
        sProfile.style.border = "none";
        sProfile.style.backdropFilter = "none";
        if (document.getElementById("profile-overlay-close")) {
            document.getElementById("profile-overlay-close").style.display = "none";
        }
        
        document.querySelectorAll('.rooms-main').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if (targetUid === AppState.currentUser?.uid) {
           const navMy = document.getElementById('nav-profile');
           if (navMy) navMy.classList.add('active');
        } else {
           const navMy = document.getElementById('nav-profile');
           if (navMy) navMy.classList.remove('active');
        }
        sProfile.style.display = "flex";
    }

    let profile = AppState.usersCache.get(targetUid);
    
    // Скелетон UI
    const renderSkeleton = () => {
      Utils.$("view-name").innerHTML = `<div style="width: 150px; height: 20px; background: rgba(255,255,255,0.1); border-radius: 6px; animation: pulse 1.5s infinite;"></div>`;
      Utils.$("view-username").innerHTML = `<div style="width: 100px; height: 14px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 6px; animation: pulse 1.5s infinite;"></div>`;
      document.querySelectorAll(".view-bio").forEach(el => el.innerHTML = `
        <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 6px; animation: pulse 1.5s infinite;"></div>
        <div style="width: 80%; height: 12px; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 12px; animation: pulse 1.5s infinite;"></div>
        <div style="width: 100px; height: 12px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-top: 10px; animation: pulse 1.5s infinite;"></div>
      `);
      if (Utils.$("view-avatar")) Utils.$("view-avatar").innerHTML = `<div style="width: 100%; height: 100%; background: rgba(255,255,255,0.1); border-radius: 50%; animation: pulse 1.5s infinite;"></div>`;
      if (Utils.$("view-badges-collection")) Utils.$("view-badges-collection").innerHTML = "";
      document.querySelectorAll(".view-status").forEach(el => el.innerHTML = `<div style="width: 80px; height: 14px; background: rgba(255,255,255,0.08); border-radius: 4px; display: inline-block; animation: pulse 1.5s infinite;"></div>`);
      if (Utils.$("view-streak")) Utils.$("view-streak").style.display = "none";
      if (Utils.$("view-gender")) Utils.$("view-gender").style.display = "none";
      ProfileManager.applyProfileBanner(vModal, null);
    };

    if (profile) {
      Utils.$("view-name").innerHTML = `${window.PremiumManager ? PremiumManager.getStatusEmojiHtml(profile, targetUid) : ""}${Utils.escapeHtml(profile.name)}`;
      Utils.$("view-username").innerHTML = `@${Utils.escapeHtml(profile.username)}`;
      if (Utils.$("view-avatar")) Utils.$("view-avatar").innerHTML = ProfileManager.getAvatarHtml(profile);
      ProfileManager.applyProfileBanner(vModal, profile);

      
      const safeBioPreview = Utils.escapeHtml(profile.bio || "Пользователь не добавил описание.");
      const needsExpansion = safeBioPreview.length > 200;
      document.querySelectorAll(".view-bio").forEach(el => el.innerHTML = `
        <div class="premium-bio-layout ${needsExpansion ? "collapsed" : ""}" id="profile-bio-content" style="position: relative; transition: max-height 0.3s ease-out; ${needsExpansion ? "max-height: 75px; overflow: hidden;" : "max-height: none; overflow: visible;"}">
          ${safeBioPreview}
        </div>
        ${needsExpansion ? `<button id="btn-expand-bio" style="background:none;border:none;color:var(--primary);font-size:12px;cursor:pointer;padding:0;margin: 8px auto 0; display:block; text-align:center;">Развернуть</button>` : ""}
        <div style="margin-top:12px;"></div>
        <div style="width: 150px; height: 14px; background: rgba(255,255,255,0.08); border-radius: 4px; animation: pulse 1.5s infinite; margin-top: 10px;"></div>
        <div style="width: 100px; height: 14px; background: rgba(255,255,255,0.08); border-radius: 4px; animation: pulse 1.5s infinite; margin-top: 6px;"></div>
      `);
      document.querySelectorAll(".view-status").forEach(el => el.innerHTML = `<div style="width: 80px; height: 14px; background: rgba(255,255,255,0.08); border-radius: 4px; display: inline-block; animation: pulse 1.5s infinite;"></div>`);
    } else {
      renderSkeleton();
    }
    
    
    const likeBtn = document.getElementById("btn-like-profile");
    if (likeBtn) {
       likeBtn.style.display = "flex";
       
       // Remove previous listener to avoid duplicates
       const newLikeBtn = likeBtn.cloneNode(true);
       likeBtn.parentNode.replaceChild(newLikeBtn, likeBtn);
       
       const likeIcon = newLikeBtn.querySelector("#like-icon") || document.getElementById("like-icon");
       const likesCount = newLikeBtn.querySelector("#view-likes-count") || document.getElementById("view-likes-count");

       const isSelf = targetUid === AppState.currentUser?.uid;
       if (isSelf) {
          newLikeBtn.style.opacity = "0.5";
          newLikeBtn.style.cursor = "not-allowed";
       } else {
          newLikeBtn.style.opacity = "1";
          newLikeBtn.style.cursor = "pointer";
       }

       // Кнопка жалобы на профиль в модерацию
       const reportBtn = document.getElementById("btn-report-profile");
       if (reportBtn) {
          if (isSelf) {
             reportBtn.style.display = "none";
          } else {
             reportBtn.style.display = "inline-flex";
             reportBtn.onclick = () => {
                ReportManager.openProfileReportModal(targetUid);
             };
          }
       }

       // Helper to update UI
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          if (likesCount) likesCount.innerText = count;
          if (likeIcon && AppState.currentUser) {
            const btn = document.getElementById("btn-like-profile");
            if (likedBy[AppState.currentUser.uid]) {
                if (btn) btn.classList.add("liked");
                likeIcon.style.filter = "";
                likeIcon.style.transform = "";
            } else {
                if (btn) btn.classList.remove("liked");
                likeIcon.style.filter = "";
                likeIcon.style.transform = "";
            }
          }
       };
       
       updateLikeUI(profile);
       
       newLikeBtn.addEventListener("click", async () => {
          if (isSelf) {
              // Open Like Stats Modal
              Utils.$("modal-like-stats").classList.add("active");
              const likedBy = profile.likedBy || {};
              Utils.$("like-stats-total").innerText = Object.keys(likedBy).length;
              
              const listEl = Utils.$("like-stats-list");
              listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Загрузка...</div>';
              
              const likesArray = Object.entries(likedBy)
                .map(([uid, ts]) => ({ uid, ts }))
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 10);
                
              if (likesArray.length === 0) {
                 listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);">Пока никто не поставил вам лайк.</div>';
                 return;
              }
              
              Promise.all(likesArray.map(async (likeObj) => {
                  if (likeObj.uid.startsWith("fake_like_")) {
                      return `<div style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;">
                          <div style="flex:1;display:flex;flex-direction:column;">
                              <span style="font-weight:600;">Неизвестный пользователь</span>
                              <span style="font-size:11px;color:var(--text-muted);">${new Date(likeObj.ts).toLocaleString("ru-RU")}</span>
                          </div>
                      </div>`;
                  }
                  
                  const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js").then(({get, ref, getDatabase}) => get(ref(getDatabase(), `users/${likeObj.uid}/profile`)));
                  const prof = snap.val() || {};
                  const avHtml = ProfileManager.getAvatarHtml(prof);
                  return `<div style="display:flex;align-items:center;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;cursor:pointer;transition:background 0.2s;" onclick="ProfileManager.openViewProfileModal('${likeObj.uid}')">
                      <div style="width:36px;height:36px;margin-right:12px;border-radius:50%;overflow:visible;">${avHtml}</div>
                      <div style="flex:1;display:flex;flex-direction:column;">
                          <span style="font-weight:600;">${Utils.escapeHtml(prof.name || "Пользователь")}</span>
                          <span style="font-size:11px;color:var(--text-muted);">${new Date(likeObj.ts).toLocaleString("ru-RU")}</span>
                      </div>
                  </div>`;
              })).then(htmlArr => {
                  listEl.innerHTML = htmlArr.join("");
              });
              
              return;
          }
          if (!AppState.currentUser) return;
          
          try {
             const myUid = AppState.currentUser.uid;
             const likedRef = ref(db, `users/${targetUid}/profile/likedBy/${myUid}`);
             
             // Check current state from cache or fetch
             const profSnap = await get(ref(db, `users/${targetUid}/profile/likedBy/${myUid}`));
             if (profSnap.exists()) {
                await remove(likedRef);
             } else {
                await set(likedRef, Date.now());
                Utils.toast(`Вы поставили лайк пользователю ${profile.name || "Пользователь"}`, "success");
                
                const layer = Utils.$("reaction-layer");
                if (layer) {
                    for (let i = 0; i < 8; i++) {
                        const heart = document.createElement("div");
                        heart.className = "floating-emoji";
                        heart.innerHTML = '<img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Symbols/Red%20Heart.webp" style="width: 48px; height: 48px; filter: drop-shadow(0 4px 12px rgba(255, 0, 0, 0.4));">';
                        
                        // Start position around bottom center of screen or button
                        heart.style.left = `${Math.random() * 40 + 30}%`; // 30% to 70%
                        heart.style.bottom = "-50px";
                        
                        // Custom animation delay and duration
                        heart.style.animationDelay = `${Math.random() * 0.3}s`;
                        heart.style.animationDuration = `${2 + Math.random() * 1}s`;
                        
                        layer.appendChild(heart);
                        setTimeout(() => heart.remove(), 3500);
                    }
                }
             }
             
             // Refresh profile
             const freshProfSnap = await get(ref(db, `users/${targetUid}/profile`));
             if (freshProfSnap.exists()) {
                const freshP = freshProfSnap.val();
                AppState.usersCache.set(targetUid, freshP);
                updateLikeUI(freshP);
             }
          } catch (err) {
             console.error("Like error", err); Utils.toast(err.message, "error");
          }
       });
    }

    vModal.classList.add("active");

    const fetchPromises = [
      profile ? Promise.resolve(profile) : this.loadUser(targetUid),
      get(ref(db, `users/${targetUid}/friends`)),
      get(ref(db, `users/${targetUid}/status`))
    ];

    const [loadedProfile, friendsSnap, statusSnap] = await Promise.all(fetchPromises);

    // If another profile request started while this was loading, discard this one!
    if (this._profileReqCounter !== thisReqId) return;
    
    // Если профиля не было в кеше, обновляем шапку
    if (!profile && loadedProfile) {
      Utils.$("view-name").innerHTML = `${window.PremiumManager ? PremiumManager.getStatusEmojiHtml(loadedProfile, targetUid) : ""}${Utils.escapeHtml(loadedProfile.name)}`;
      Utils.$("view-username").innerHTML = `@${Utils.escapeHtml(loadedProfile.username)}`;
      if (Utils.$("view-avatar")) Utils.$("view-avatar").innerHTML = ProfileManager.getAvatarHtml(loadedProfile);
      ProfileManager.applyProfileBanner(vModal, loadedProfile);
    }
    
    profile = loadedProfile;
    if (profile && profile.username) {
       this._currentlyOpenUsername = profile.username.toLowerCase().trim();
       const isSelf = targetUid === AppState.currentUser?.uid;
       const expectedPath = isSelf ? "/profile" : `/@${profile.username}`;
       const isRoomActive =
         document.getElementById("room-screen")?.classList.contains("active") ||
         AppState.currentRoomId;
       if (!isRoomActive && window.location.pathname !== expectedPath) {
           if (window.Router) window.Router.currentPath = expectedPath;
           window.history.replaceState({ screenId: "profile-screen", _silent: true }, "", expectedPath);
       }
    }
    
    if (document.getElementById("btn-like-profile")) {
       
       const likeIcon = document.getElementById("like-icon");
       const likesCount = document.getElementById("view-likes-count");
       const updateLikeUI = (p) => {
          if (!p) return;
          const likedBy = p.likedBy || {};
          const count = Object.keys(likedBy).length;
          if (likesCount) likesCount.innerText = count;
          if (likeIcon && AppState.currentUser) {
            const btn = document.getElementById("btn-like-profile");
            if (likedBy[AppState.currentUser.uid]) {
                if (btn) btn.classList.add("liked");
                likeIcon.style.filter = "";
                likeIcon.style.transform = "";
            } else {
                if (btn) btn.classList.remove("liked");
                likeIcon.style.filter = "";
                likeIcon.style.transform = "";
            }
          }
       };
       updateLikeUI(profile);
    }

    if (!profile) {

      vModal.classList.remove("active");
      return Utils.toast("Пользователь не найден", "error");
    }

    const activeStreak = this.getActiveStreak(profile);
    const streakEl = Utils.$("view-streak");
    if (streakEl) {
      if (activeStreak > 0) {
        streakEl.style.display = "inline-flex";
        if (Utils.$("view-streak-count")) Utils.$("view-streak-count").innerText = activeStreak;
      } else {
        streakEl.style.display = "none";
      }
    }

    // New math logic
    const updateLevelUI = (xpVal) => {
      const math = ProfileManager.getExpMath(xpVal);
      const isNegative = xpVal < 0;
      const lvl = math.level;

      // Update Mini Badge
      const viewLevelBadge = Utils.$("view-level-badge");
      const viewLevelBadgeText = Utils.$("view-level-badge-text");
      const viewLevelBadgeIcon = Utils.$("view-level-badge-icon");

      if (isNegative) {
        if (viewLevelBadgeText) viewLevelBadgeText.innerText = `Скрыт`;
        if (viewLevelBadgeIcon)
          viewLevelBadgeIcon.style.filter = "grayscale(100%) opacity(50%)";
        if (viewLevelBadge) {
          viewLevelBadge.style.background = "rgba(255,59,48,0.15)";
          viewLevelBadge.style.border = "1px solid rgba(255,59,48,0.3)";
        }
      } else {
        if (viewLevelBadgeText) viewLevelBadgeText.innerText = `Уровень ${lvl}`;
        if (viewLevelBadgeIcon)
          viewLevelBadgeIcon.style.filter =
            "drop-shadow(0 2px 4px rgba(255, 170, 0, 0.4))";
        if (viewLevelBadge) {
          viewLevelBadge.style.background = "rgba(34,34,34,0.8)";
          viewLevelBadge.style.border = "1px solid rgba(255,255,255,0.08)";
        }
      }

      // Update Drawer Header and Progress
      const drawerTitle = Utils.$("drawer-level-title");
      if (drawerTitle)
        drawerTitle.innerText = isNegative ? `Рейтинг скрыт` : `Уровень ${lvl}`;

      const drawerStarContainer = Utils.$("drawer-star-container");
      if (drawerStarContainer) {
        if (isNegative)
          drawerStarContainer.style.filter =
            "grayscale(100%) opacity(50%) drop-shadow(0 4px 15px rgba(255,0,0,0.2))";
        else drawerStarContainer.style.filter = "none";
      }

      if (Utils.$("drawer-xp-text")) {
        Utils.$("drawer-xp-text").innerText = isNegative
          ? `Ненадежный статус (${xpVal} XP)`
          : `${math.current.toLocaleString()} / ${math.needed.toLocaleString()} 🌟`;
      }
      if (Utils.$("drawer-xp-progress")) {
        Utils.$("drawer-xp-progress").style.width = isNegative
          ? "0%"
          : `${math.percent}%`;
      }

      const drawerXpBarContainer = Utils.$("drawer-xp-bar-container");
      if (drawerXpBarContainer) {
        drawerXpBarContainer.style.display = isNegative ? "none" : "block";
      }
    };

    updateLevelUI(Number(profile.xp) || 0);

    const lumensBadge = Utils.$("view-lumens-badge");
    const lumensCount = Utils.$("view-lumens-count");
    if (lumensBadge) {
      lumensBadge.style.display = "inline-flex";
      if (lumensCount) {
        lumensCount.innerText = (Number(profile.lumens) || 0).toLocaleString();
      }
    }

    const giftBtn = Utils.$("btn-gift-lumens");
    const currentUid = AppState.currentUser?.uid;
    if (giftBtn) {
      if (currentUid && targetUid !== currentUid) {
        giftBtn.style.display = "inline-flex";
        giftBtn.onclick = () => ProfileManager.giftLumens(targetUid, profile);
      } else {
        giftBtn.style.display = "none";
        giftBtn.onclick = null;
      }
    }

    if (this._profileReqCounter !== thisReqId) return;

    if (this.viewUnsubs) {
      this.viewUnsubs.forEach((f) => { try { f(); } catch (e) {} });
      this.viewUnsubs = [];
    } else {
      this.viewUnsubs = [];
    }

    const profileRef = ref(db, `users/${targetUid}/profile`);
    const pUnsub = onValue(profileRef, (snap) => {
      const val = snap.val();
      if (val) {
        updateLevelUI(Number(val.xp) || 0);
        if (lumensCount) {
          lumensCount.innerText = (Number(val.lumens) || 0).toLocaleString();
        }
        const statRt = document.getElementById("view-stat-room-time");
        if (statRt && val.timeSpentInRooms !== undefined) {
          statRt.innerText = Utils.formatDuration(val.timeSpentInRooms || 0);
        }
      }
    });
    this.viewUnsubs.push(() => off(profileRef, "value", pUnsub));

    // Drawer logic
    const bottomSheetOverlay = Utils.$("level-bottom-sheet-overlay");
    const bottomSheet = Utils.$("level-bottom-sheet");
    const badgeBtn = Utils.$("view-level-badge");
    const closeBtn = bottomSheet.querySelector(".btn-close-drawer");

    const closeDrawer = () => {
      bottomSheet.style.transform = "translateY(100%)";
      bottomSheetOverlay.style.opacity = "0";
      setTimeout(() => {
        bottomSheetOverlay.style.display = "none";
      }, 300);
    };

    if (badgeBtn) {
      badgeBtn.onclick = () => {
        bottomSheetOverlay.style.display = "block";
        // Trigger reflow
        void bottomSheetOverlay.offsetWidth;
        bottomSheetOverlay.style.opacity = "1";
        bottomSheet.style.transform = "translateY(0)";
      };
    }

    if (bottomSheetOverlay) bottomSheetOverlay.onclick = closeDrawer;
    if (closeBtn) closeBtn.onclick = closeDrawer;

    const friendsCount = friendsSnap.exists()
      ? Object.values(friendsSnap.val()).filter((f) => f.status === "accepted")
          .length
      : 0;
    const friendsBtn = Utils.$("view-friends-count");
    const friendsText = Utils.$("view-friends-count-text");
    if (friendsText) {
      friendsText.innerText = `Друзья · ${friendsCount}`;
    } else if (friendsBtn) {
      friendsBtn.innerText = `Друзей: ${friendsCount}`;
    }
    if (friendsBtn) {
      friendsBtn.style.cursor = "pointer";
      friendsBtn.onclick = () => {
        ProfileManager.openFriendsListModal(targetUid, profile?.name || "Пользователь");
      };
    }
    const joinDate = profile.createdAt
      ? new Date(profile.createdAt).toLocaleDateString()
      : "Неизвестно";

    const st = statusSnap.val() || {};
    const isOnline = st.online;
    const statusText = isOnline
      ? "Онлайн"
      : st.lastSeen
        ? `Был(а) ${Utils.formatLastSeen(st.lastSeen)}`
        : "Офлайн";
    document.querySelectorAll(".view-status").forEach(el => el.innerHTML = `<div class="indicator ${isOnline ? "online" : ""}" style="width:8px;height:8px;border-radius:50%;background:${isOnline ? "#4caf50" : "#888"};display:inline-block;margin-right:6px;"></div>${statusText}`);

    const badgeHtml = this.getRoleBadgeHtml(profile, targetUid);

    let genderString = "";
    if (profile.gender === "female") {
      genderString =
        'Пол: Женский <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Woman%20Technologist.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;" alt="Женщина">';
    } else if (profile.gender === "male") {
      genderString =
        'Пол: Мужской <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Man%20Technologist.webp" style="width:1.2em;height:1.2em;vertical-align:bottom;" alt="Мужчина">';
    }
    if (Utils.$("view-gender")) {
      Utils.$("view-gender").innerHTML = genderString;
      Utils.$("view-gender").style.display = genderString ? "block" : "none";
    }

    Utils.$("view-name").innerHTML =
      `${window.PremiumManager ? PremiumManager.getStatusEmojiHtml(profile, targetUid) : ""}${Utils.escapeHtml(profile.name)} ${badgeHtml}`;
    Utils.$("view-username").innerHTML =
      `@${Utils.escapeHtml(profile.username)}` +
      (profile.extraUsernames && profile.extraUsernames.length > 0
        ? `<br><span style="opacity:0.7;font-size:0.9em;">` +
          profile.extraUsernames
            .map((u) => `@${Utils.escapeHtml(u)}`)
            .join(" | ") +
          `</span>`
        : "");
    const safeBio = Utils.escapeHtml(
      profile.bio || "Пользователь не добавил описание.",
    );

    const isPremium = window.PremiumManager
      ? PremiumManager.isPremiumActive(profile, targetUid)
      : false;
    const bioLayoutClass = "premium-bio-layout";

    // Убираем баг с пропаданием информации. Даем height: auto при разворачивании. 
    const LIMIT = 200;

    const statCreated = document.getElementById("view-stat-created");
    if (statCreated) {
       statCreated.innerText = profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Неизвестно";
    }
    const statUid = document.getElementById("view-stat-uid");
    if (statUid) {
       statUid.innerText = targetUid || "Неизвестно";
    }
    const statLastLogin = document.getElementById("view-stat-login");
    if (statLastLogin) {
       statLastLogin.innerText = profile.lastLoginDate || "Неизвестно";
    }
    const statRoomTime = document.getElementById("view-stat-room-time");
    if (statRoomTime) {
       statRoomTime.innerText = Utils.formatDuration(profile.timeSpentInRooms || 0);
    }

    const needsExpansion = safeBio.length > LIMIT;

    document.querySelectorAll(".view-bio").forEach(el => el.innerHTML = `
            <div class="${bioLayoutClass} ${needsExpansion ? "collapsed" : ""}" id="profile-bio-content" style="position: relative; transition: max-height 0.3s ease-out; ${needsExpansion ? "max-height: 75px; overflow: hidden;" : "max-height: none; overflow: visible;"}">
              ${safeBio}
            </div>
            ${needsExpansion ? `<button id="btn-expand-bio" style="background:none;border:none;color:var(--primary);font-size:12px;cursor:pointer;padding:0;margin: 8px auto 0; display:block; text-align:center;">Развернуть</button>` : ""}
            <div style="margin-top:12px;"></div>
        `);

    setTimeout(() => {
      const bioContent = Utils.$("profile-bio-content");
      const expandBtn = Utils.$("btn-expand-bio");

      if (bioContent && expandBtn) {
        expandBtn.onclick = () => {
          const isCollapsed = bioContent.classList.contains("collapsed");
          if (isCollapsed) {
            bioContent.classList.remove("collapsed");
            bioContent.style.maxHeight = bioContent.scrollHeight + "px";
            // Wait for transition to complete then remove overflow hiding to prevent text cutoff issues
            setTimeout(() => {
               if(!bioContent.classList.contains("collapsed")) {
                  bioContent.style.maxHeight = "none";
                  bioContent.style.overflow = "visible";
               }
            }, 350);
            expandBtn.innerText = "Свернуть";
          } else {
            bioContent.classList.add("collapsed");
            bioContent.style.overflow = "hidden";
            // Force reflow
            void bioContent.offsetWidth;
            bioContent.style.maxHeight = "75px";
            expandBtn.innerText = "Развернуть";
          }
        };
      }
    }, 50);

    const badgesContainer = Utils.$("view-badges-collection");
    if (badgesContainer) {
      badgesContainer.innerHTML = "";

      let userBadges = [];
      if (profile.assignedBadges && Array.isArray(profile.assignedBadges)) {
        const systemFallbacks = {
          lvl_10: {
            name: "Ветеран",
            desc: "Достиг 10 уровня",
            icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Star.webp",
            color: "#cddc39",
            xp: 0,
            bg: "rgba(205, 220, 57, 0.2)",
            border: "#cddc39",
          },
          lvl_25: {
            name: "Мастер",
            desc: "Достиг 25 уровня",
            icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Animals%20and%20Nature/Fire.webp",
            color: "#ff9800",
            xp: 0,
            bg: "rgba(255, 152, 0, 0.2)",
            border: "#ff9800",
          },
          lvl_50: {
            name: "Легенда",
            desc: "Достиг 50 уровня",
            icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Gem%20Stone.webp",
            color: "#2196f3",
            xp: 0,
            bg: "rgba(33, 150, 243, 0.2)",
            border: "#2196f3",
          },
          lvl_100: {
            name: "Божество",
            desc: "Достиг 100 уровня",
            icon: "https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/Objects/Crown.webp",
            color: "#ffeb3b",
            xp: 0,
            bg: "rgba(255, 235, 59, 0.2)",
            border: "#ffeb3b",
          },
        };
        profile.assignedBadges.forEach((bId) => {
          if (BadgeManager.isRelationshipBadge(bId)) return;
          const b =
            (AppState.customBadges && AppState.customBadges[bId]) ||
            systemFallbacks[bId];
          if (b && !BadgeManager.isRelationshipBadge(bId, b)) {
            userBadges.push({ ...b, _id: bId });
          }
        });
      }

      // Put selected badge first
      if (profile.selectedBadge) {
        const selectedIdx = userBadges.findIndex(
          (b) => b._id === profile.selectedBadge,
        );
        if (selectedIdx > -1) {
          const sb = userBadges.splice(selectedIdx, 1)[0];
          userBadges.unshift(sb);
        }
      }

      if (userBadges.length > 0) {
        window.ProfileBadgesState = { index: 0 };

        const badgesHtml = userBadges
          .map((bdg, i) => {
            const icon = bdg.icon
              ? bdg.icon.match(/^http/)
                ? `<img src="${Utils.escapeHtml(bdg.icon)}" onerror="this.src='https://via.placeholder.com/60?text=Error'; this.onerror=null;" style="width:60px;height:60px;object-fit:contain;border-radius:6px;"/>`
                : `<span style="font-size:48px;">${Utils.escapeHtml(bdg.icon)}</span>`
              : "";
            return `
                    <div class="ach-card" data-index="${i}" style="
                        width: 160px; 
                        min-width: 160px;
                        max-width: 160px;
                        height: 180px;
                        min-height: 180px;
                        max-height: 180px;
                        flex-shrink: 0;
                        border-radius: 12px; 
                        background: rgba(0,0,0,0.2);
                        border: 1px solid var(--border-light, rgba(255,255,255,0.1));
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        cursor: pointer;
                        user-select: none;
                    ">
                        <div style="flex: 1; display:flex; align-items:flex-end; justify-content:center; width:100%; padding-bottom: 5px;">
                            ${icon}
                        </div>
                        <div style="flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding: 5px 6px; width:100%;">
                            <div style="color: #ffffff; font-weight: 800; font-size: 13px; line-height: 1.2;">${Utils.escapeHtml(bdg.name)}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 10px; margin-top:4px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">${Utils.escapeHtml(bdg.desc)}</div>
                            <div id="ach-count-${i}" style="color: rgba(255,255,255,0.5); font-size: 9.5px; margin-top:6px; font-weight: 600;">Уже получили: ...</div>
                        </div>
                    </div>`;
          })
          .join("");

        badgesContainer.innerHTML = `
                    <div style="width:100%; font-size:12px; color:var(--text-muted); font-weight:700; margin-bottom:8px; text-align:left; opacity:0.7; letter-spacing:0.5px;">ПОСТИЖЕНИЯ И АЧИВКИ</div>
                    <div style="position:relative; width:100%; height:200px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <button id="badge-prev" style="position:absolute; left:6px; z-index:10; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:white; border-radius:50%; width:34px; height:34px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">‹</button>
                        <div class="badge-carousel-wrap" style="width:100%; max-width:480px; height:100%; position:relative; overflow:hidden; mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 12%, black 88%, transparent);">
                            <div id="badge-track" style="display:flex; height:100%; align-items:center; transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform:translateX(0px); gap:16px; width:max-content; box-sizing:content-box;">
                                ${badgesHtml}
                            </div>
                        </div>
                        <button id="badge-next" style="position:absolute; right:6px; z-index:10; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); color:white; border-radius:50%; width:34px; height:34px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">›</button>
                    </div>
                    <!-- Action for selected badge -->
                    <div id="badge-action-container" style="text-align:left; height:30px; margin-top:8px;"></div>
                `;

        const updateBadgeCarousel = () => {
          const track = Utils.$("badge-track");
          if (!track) return;
          const items = track.querySelectorAll(".ach-card");
          if (items.length === 0) return;

          const itemWidth = 160;
          const gap = 20;
          const step = itemWidth + gap;

          const wrapElem = badgesContainer.querySelector(
            ".badge-carousel-wrap",
          );
          let wrapWidth = 0;
          if (wrapElem && wrapElem.clientWidth > 0) {
            wrapWidth = wrapElem.clientWidth;
          } else {
            let modalParent = badgesContainer.closest(".modal-content");
            if (modalParent && modalParent.clientWidth > 0) {
              wrapWidth = modalParent.clientWidth - 48;
            } else {
              wrapWidth = Math.min(440, window.innerWidth - 32) - 48;
            }
          }
          if (wrapWidth < 100)
            wrapWidth = Math.min(440, window.innerWidth - 32) - 48;

          const centerOffset = Math.floor(wrapWidth / 2 - itemWidth / 2);

          track.style.transform = `translate3d(${centerOffset - window.ProfileBadgesState.index * step}px, 0, 0)`;

          items.forEach((el, i) => {
            // Ensure all cards are visible
            el.style.visibility = "visible";
            if (i === window.ProfileBadgesState.index) {
              el.style.transform = "scale(1)";
              el.style.opacity = "1";
              el.style.filter = "brightness(1)";
              el.style.zIndex = "5";
              el.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
            } else {
              el.style.transform = "scale(0.85)";
              el.style.opacity = "0.5";
              el.style.filter = "brightness(0.5)";
              el.style.zIndex = "1";
              el.style.boxShadow = "none";
            }
          });

          // Update the action button
          const actionContainer = Utils.$("badge-action-container");
          const activeBadge = userBadges[window.ProfileBadgesState.index];
          if (actionContainer && activeBadge) {
            if (targetUid === AppState.currentUser.uid && activeBadge._id) {
              if (profile.selectedBadge === activeBadge._id) {
                actionContainer.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">Установлен как основной</span>`;
              } else {
                actionContainer.innerHTML = `<button class="secondary-btn" id="btn-select-main-badge" style="padding: 4px 12px; font-size: 11px; width: auto; display: inline-block;">Выбрать основным</button>`;
                Utils.$("btn-select-main-badge").onclick = () => {
                  update(ref(db, `users/${targetUid}/profile`), {
                    selectedBadge: activeBadge._id,
                  }).then(() => {
                    profile.selectedBadge = activeBadge._id;
                    updateBadgeCarousel();
                    Utils.toast("Бейдж установлен основным!");
                  });
                };
              }
            } else {
              actionContainer.innerHTML = "";
            }
          }
        };

        Utils.$("badge-prev").onclick = () => {
          if (window.ProfileBadgesState.index > 0) {
            window.ProfileBadgesState.index--;
            updateBadgeCarousel();
          }
        };

        Utils.$("badge-next").onclick = () => {
          if (window.ProfileBadgesState.index < userBadges.length - 1) {
            window.ProfileBadgesState.index++;
            updateBadgeCarousel();
          }
        };

        let badgeStartX = 0;
        let badgeEndX = 0;
        const trackElem = Utils.$("badge-track");
        if (trackElem) {
          trackElem.addEventListener(
            "touchstart",
            (e) => {
              badgeStartX = e.touches[0].clientX;
              window.isDraggingBadge = false;
            },
            { passive: true },
          );
          trackElem.addEventListener("touchmove", () => {
              window.isDraggingBadge = true;
          }, { passive: true });
          trackElem.addEventListener("touchend", (e) => {
            setTimeout(() => { window.isDraggingBadge = false; }, 50);
            badgeEndX = e.changedTouches[0].clientX;
            const diff = badgeEndX - badgeStartX;
            if (diff > 40 && window.ProfileBadgesState.index > 0) {
              window.ProfileBadgesState.index--;
              updateBadgeCarousel();
            } else if (
              diff < -40 &&
              window.ProfileBadgesState.index < userBadges.length - 1
            ) {
              window.ProfileBadgesState.index++;
              updateBadgeCarousel();
            }
          });
        }

        badgesContainer.querySelectorAll(".ach-card").forEach((card, i) => {
          card.onclick = () => {
            if (window.isDraggingBadge) {
                window.isDraggingBadge = false;
                return;
            }
            window.ProfileBadgesState.index = i;
            updateBadgeCarousel();
          };
        });

        setTimeout(updateBadgeCarousel, 50);
        setTimeout(updateBadgeCarousel, 200);
        setTimeout(updateBadgeCarousel, 500);
        setTimeout(updateBadgeCarousel, 250);
        setTimeout(updateBadgeCarousel, 500);

        // Fetch counts asynchronously
        get(ref(db, "users"))
          .then((snap) => {
            const allUsers = snap.val() || {};
            const badgeCounts = {};
            for (const u of Object.values(allUsers)) {
              let assigned = u.profile?.assignedBadges;
              if (Array.isArray(assigned)) {
                assigned.forEach((bId) => {
                  badgeCounts[bId] = (badgeCounts[bId] || 0) + 1;
                });
              }
            }

            userBadges.forEach((bdg, i) => {
              const countEl = Utils.$(`ach-count-${i}`);
              if (countEl) {
                const num =
                  badgeCounts[bdg._id] ||
                  badgeCounts[bdg.id] ||
                  badgeCounts[bdg.type] ||
                  0;
                countEl.innerHTML = `Уже получили: ${num}`;
              }
            });
          })
          .catch((e) => console.error(e));
      }
    }

    const hashtagsEl = Utils.$("view-hashtags");
    const profileTags = Array.isArray(profile.hashtags) ? profile.hashtags : [];
    hashtagsEl.innerHTML = profileTags
      .map(
        (tag) => `<span class="hashtag-chip">${Utils.escapeHtml(tag)}</span>`,
      )
      .join("");
    

    const avatarEl = Utils.$("view-avatar");
    avatarEl.innerHTML = ProfileManager.getAvatarHtml(profile);

    const actionBtn = Utils.$("btn-dm-modal");
                        if (targetUid === AppState.currentUser.uid) {
      actionBtn.style.display = "inline-flex";
      actionBtn.innerText = "Изменить профиль";
      actionBtn.className = "primary-btn";
      actionBtn.style.color = "#FFFFFF";
      actionBtn.style.background = "rgba(255, 255, 255, 0.1)";
      actionBtn.style.border = "none";
      actionBtn.style.padding = "6px 16px";
      actionBtn.style.fontSize = "14px";
      actionBtn.onclick = () => {
         
         ProfileManager.openEditProfileModal();
      };
      
          } else {
      actionBtn.style.display = "inline-flex";
      actionBtn.className = "primary-btn";
      actionBtn.style.background = "#FFFFFF"; actionBtn.style.color = "#000000";
      actionBtn.style.padding = "6px 16px";
      actionBtn.style.fontSize = "14px";
      actionBtn.innerText = "Написать сообщение";
      actionBtn.style.border = "none";
      
      const myFriendsSnap = await get(
        ref(db, `users/${AppState.currentUser.uid}/friends/${targetUid}`),
      );
      const isFriend =
        myFriendsSnap.exists() && myFriendsSnap.val().status === "accepted";
      
      if (isFriend) {
        actionBtn.innerText = "Написать сообщение";
        actionBtn.onclick = () => {
          
          DirectMessages.openChat(targetUid, profile.name);
        };
      } else {
        actionBtn.innerText = "Добавить в друзья";
        actionBtn.onclick = () => {
          FriendsManager.sendFriendRequest(targetUid);
          
        };
      }
    }
    
    const vAvatar = Utils.$("view-avatar");

    if (
      typeof AdminPanel !== "undefined" &&
      AdminPanel.isCurrentUserCreator()
    ) {
      let inspector = vModal.querySelector("#live-user-inspector");
      if (!inspector) {
        inspector = document.createElement("div");
        inspector.id = "live-user-inspector";
        inspector.style.position = "fixed";
        inspector.style.bottom = "20px";
        inspector.style.left = "20px";
        inspector.style.padding = "16px 20px";
        inspector.style.background = "rgba(10, 10, 14, 0.94)";
        inspector.style.backdropFilter = "blur(14px)";
        inspector.style.border = "1px solid rgba(255, 255, 255, 0.15)";
        inspector.style.borderRadius = "16px";
        inspector.style.color = "#fff";
        inspector.style.zIndex = "9999";
        inspector.style.pointerEvents = "auto";
        inspector.style.fontFamily = "Consolas, monospace";
        inspector.style.fontSize = "12px";
        inspector.style.boxShadow = "0 12px 40px rgba(0,0,0,0.8)";
        inspector.style.textAlign = "left";
        inspector.style.minWidth = "260px";
        vModal.appendChild(inspector);
      } else {
        inspector.style.display = "block";
      }

      const userData = await get(ref(db, `users/${targetUid}`)).then(
        (s) => s.val() || {},
      );
      const moderation = userData?.moderation || {};
      const lastSessionDate = userData?.status?.lastActive
        ? Utils.formatExactDate(userData.status.lastActive)
        : profile.lastLoginDate || "unknown";

      inspector.innerHTML = `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:6px;">
            <div style="font-weight:800; font-family:var(--font-sans); font-size:14px; color:var(--accent);">Live Inspector</div>
            <button id="btn-close-live-inspector" style="background:rgba(255,255,255,0.1); border:none; color:#fff; cursor:pointer; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; line-height:1; transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'" title="Закрыть">✕</button>
          </div>
          <div style="line-height: 1.6;">
            <div>UID: <span style="color:#aaa;">${targetUid}</span></div>
            <div>Current IP: <span style="color:#0ff">${Utils.escapeHtml(userData?.status?.ip || "unavailable")}</span></div>
            <div>Reg IP: <span style="color:#0ff">${Utils.escapeHtml(profile.registeredIp || "unknown")}</span></div>
            <div>Last Active: <span style="color:#0f0">${lastSessionDate}</span></div>
            <div>Reg: <span style="color:#ddd">${profile.createdAt ? Utils.formatExactDate(profile.createdAt) : "unknown"}</span></div>
            <div>Bans: <span style="color:${Array.isArray(moderation.banHistory) && moderation.banHistory.length > 0 ? '#ff4757' : '#aaa'}">${Array.isArray(moderation.banHistory) ? moderation.banHistory.length : 0}</span></div>
            <div>Muted: <span style="color:${moderation.muted ? '#ff4757' : '#0f0'}">${moderation.muted ? "Yes" : "No"}</span></div>
            <div>Shadowban: <span style="color:${moderation.shadowban ? '#ff4757' : '#0f0'}">${moderation.shadowban ? "Yes" : "No"}</span></div>
          </div>
      `;

      const closeBtn = inspector.querySelector("#btn-close-live-inspector");
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          inspector.style.display = "none";
        };
      }
    }
  }

  static closeFriendsListModal() {
    const modal = document.getElementById("modal-profile-friends");
    if (modal) modal.classList.remove("active");
  }

  static async openFriendsListModal(targetUid, profileName = "Пользователь") {
    if (!targetUid) return;
    const modal = document.getElementById("modal-profile-friends");
    if (!modal) return;

    const titleEl = document.getElementById("profile-friends-modal-title");
    const subtitleEl = document.getElementById("profile-friends-modal-subtitle");
    const listEl = document.getElementById("profile-friends-modal-list");
    const searchInput = document.getElementById("profile-friends-search");

    if (searchInput) searchInput.value = "";

    const isSelf = targetUid === AppState.currentUser?.uid;
    if (titleEl) {
      titleEl.innerText = isSelf ? "Мои друзья" : `Друзья • ${profileName}`;
    }
    if (subtitleEl) {
      subtitleEl.innerText = "Загрузка списка друзей...";
    }

    if (listEl) {
      listEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; padding:4px 0;">
          <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
            <div style="width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,0.08); animation:pulse 1.5s infinite;"></div>
            <div style="flex:1;">
              <div style="width:120px; height:14px; background:rgba(255,255,255,0.1); border-radius:6px; animation:pulse 1.5s infinite; margin-bottom:8px;"></div>
              <div style="width:80px; height:11px; background:rgba(255,255,255,0.05); border-radius:6px; animation:pulse 1.5s infinite;"></div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
            <div style="width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,0.08); animation:pulse 1.5s infinite;"></div>
            <div style="flex:1;">
              <div style="width:140px; height:14px; background:rgba(255,255,255,0.1); border-radius:6px; animation:pulse 1.5s infinite; margin-bottom:8px;"></div>
              <div style="width:70px; height:11px; background:rgba(255,255,255,0.05); border-radius:6px; animation:pulse 1.5s infinite;"></div>
            </div>
          </div>
        </div>
      `;
    }

    modal.classList.add("active");

    try {
      const { get, ref, getDatabase } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js");
      const dbInstance = getDatabase();
      const friendsSnap = await get(ref(dbInstance, `users/${targetUid}/friends`));
      const friendsVal = friendsSnap.val() || {};

      const friendUids = Object.keys(friendsVal).filter(
        (uid) => friendsVal[uid] && friendsVal[uid].status === "accepted"
      );

      if (subtitleEl) {
        subtitleEl.innerText = `${friendUids.length} друзей`;
      }

      if (friendUids.length === 0) {
        if (listEl) {
          listEl.innerHTML = `
            <div style="text-align:center; padding:36px 16px; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:10px;">
              <img src="https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/People/Handshake.webp" style="width:52px; height:52px;" alt="Друзья" onerror="this.style.display='none';">
              <div style="font-weight:700; font-size:15px; color:#ffffff;">${isSelf ? "У вас пока нет друзей" : "У пользователя пока нет друзей"}</div>
              <div style="font-size:13px; max-width:280px;">Знакомьтесь и общайтесь в комнатах!</div>
            </div>
          `;
        }
        return;
      }

      // Load all friend profiles and status in parallel
      const friendData = await Promise.all(
        friendUids.map(async (fUid) => {
          const [prof, stSnap] = await Promise.all([
            ProfileManager.loadUser(fUid).catch(() => null),
            get(ref(dbInstance, `users/${fUid}/status`)).catch(() => null),
          ]);
          const status = stSnap?.val() || { online: false };
          return {
            uid: fUid,
            profile: prof || { name: "Пользователь", username: "user" },
            status,
          };
        })
      );

      const renderList = (filterQuery = "") => {
        if (!listEl) return;
        const q = filterQuery.toLowerCase().trim();
        const filtered = friendData.filter((item) => {
          if (!q) return true;
          const nameMatch = (item.profile.name || "").toLowerCase().includes(q);
          const userMatch = (item.profile.username || "").toLowerCase().includes(q);
          return nameMatch || userMatch;
        });

        if (filtered.length === 0) {
          listEl.innerHTML = `
            <div style="text-align:center; padding:32px 16px; color:var(--text-muted); font-size:14px;">
              Ничего не найдено по запросу "<strong>${Utils.escapeHtml(q)}</strong>"
            </div>
          `;
          return;
        }

        listEl.innerHTML = filtered.map((item) => {
          const fUid = item.uid;
          const prof = item.profile;
          const isOnline = item.status?.online;
          const statusText = isOnline
            ? "Онлайн"
            : item.status?.lastSeen
            ? `Был(а) ${Utils.formatLastSeen(item.status.lastSeen)}`
            : "Офлайн";
          const roleBadge = ProfileManager.getRoleBadgeHtml(prof, fUid);
          const avatarHtml = ProfileManager.getAvatarHtml(prof);
          const isFriendPremium = window.PremiumManager && PremiumManager.isPremiumActive(prof, fUid);

          return `
            <div class="tiktok-friend-row" data-fuid="${fUid}" style="
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 12px 14px;
              border-radius: 16px;
              background: ${isFriendPremium ? "radial-gradient(circle at 15% 50%, rgba(255, 180, 60, 0.16), transparent 50%), rgba(255,255,255,0.05)" : "rgba(255,255,255,0.05)"};
              border: 1px solid ${isFriendPremium ? "rgba(255, 200, 100, 0.3)" : "rgba(255,255,255,0.09)"};
              backdrop-filter: blur(14px);
              -webkit-backdrop-filter: blur(14px);
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            " onmouseover="this.style.background='rgba(255,255,255,0.12)'; this.style.borderColor='rgba(255,255,255,0.24)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='${isFriendPremium ? "radial-gradient(circle at 15% 50%, rgba(255, 180, 60, 0.16), transparent 50%), rgba(255,255,255,0.05)" : "rgba(255,255,255,0.05)"}'; this.style.borderColor='${isFriendPremium ? "rgba(255, 200, 100, 0.3)" : "rgba(255,255,255,0.09)"}'; this.style.transform='none';">
              <div style="position: relative; width: 46px; height: 46px; flex-shrink: 0;">
                <div class="avatar" style="width: 46px; height: 46px; border-radius: 50%; overflow: visible; font-size: 20px; margin: 0;">
                  ${avatarHtml}
                </div>
                <div class="${isOnline ? "indicator-pulsing-online" : ""}" style="
                  position: absolute;
                  bottom: -2px;
                  right: -2px;
                  width: 14px;
                  height: 14px;
                  border-radius: 50%;
                  background: ${isOnline ? "#22c55e" : "#64748b"};
                  border: 2.5px solid #10131e;
                  box-shadow: ${isOnline ? "0 0 8px rgba(34, 197, 94, 0.85)" : "none"};
                  z-index: 10;
                  pointer-events: none;
                "></div>
              </div>
              <div style="flex: 1; min-width: 0; text-align: left;">
                <div style="font-weight: 700; font-size: 14.5px; color: #ffffff; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${Utils.escapeHtml(prof.name || "Пользователь")}</span>
                  ${roleBadge}
                </div>
                <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 3px;">
                  <span style="color: rgba(255, 255, 255, 0.65); font-weight: 600;">@${Utils.escapeHtml(prof.username || "user")}</span>
                  <span>•</span>
                  <span style="color: ${isOnline ? "#22c55e" : "rgba(255,255,255,0.5)"}; font-weight: ${isOnline ? "600" : "400"};">${statusText}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                <button type="button" class="btn-friend-view-profile" data-fuid="${fUid}" style="
                  display: inline-flex;
                  align-items: center;
                  gap: 6px;
                  padding: 7px 13px;
                  border-radius: 12px;
                  background: rgba(255, 255, 255, 0.1);
                  border: 1px solid rgba(255, 255, 255, 0.18);
                  color: #ffffff;
                  font-size: 12.5px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                " onmouseover="this.style.background='rgba(255,255,255,0.22)'; this.style.borderColor='rgba(255,255,255,0.35)';" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.18)';">
                  <span>Профиль</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }).join("");

        listEl.querySelectorAll(".tiktok-friend-row").forEach((row) => {
          row.onclick = () => {
            const fUid = row.dataset.fuid;
            if (!fUid) return;
            ProfileManager.closeFriendsListModal();
            ProfileManager.openViewProfileModal(fUid);
          };
        });
      };

      renderList();

      if (searchInput) {
        searchInput.oninput = (e) => {
          renderList(e.target.value);
        };
      }
    } catch (err) {
      console.error("Friends fetch error:", err);
      if (listEl) {
        listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4d4f; font-size:13px;">Не удалось загрузить список друзей</div>`;
      }
    }
  }
}

window.ProfileManager = ProfileManager;
export { ProfileManager };
