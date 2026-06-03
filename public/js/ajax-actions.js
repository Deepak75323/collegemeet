(function () {
  var JSON_HEADERS = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  function notify(message, type) {
    if (typeof Noty === "undefined") return;
    new Noty({
      theme: "relax",
      text: message,
      type: type || "success",
      layout: "topRight",
      timeout: 1500,
    }).show();
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function authorLabel(user) {
    if (!user) return "User";
    return user.username || user.email || "User";
  }

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.slice(0, len) + "…" : str;
  }

  function mixCategory(cat) {
    if (!cat) return "web";
    var lower = String(cat).toLowerCase();
    if (["web", "app", "design"].indexOf(lower) >= 0) return lower;
    return "web";
  }

  function buildPostCard(post, currentUserId) {
    var category = post.category || "General";
    var mixCat = mixCategory(post.category);
    var card = document.createElement("article");
    card.className = "notice-card work__card mix " + mixCat;
    card.setAttribute("data-post-id", post.id);

    var imgSrc = post.blog_image || "/images/work-1.webp";
    var author = authorLabel(post.user);
    var desc = truncate(post.description, 140);

    var deleteBtn =
      currentUserId && String(post.user.id) === String(currentUserId)
        ? '<button type="button" class="notice-card__delete post-delete-btn work__edit" data-post-id="' +
          post.id +
          '" title="Delete notice" aria-label="Delete"><i class="uil uil-trash-alt"></i></button>'
        : "";

    card.innerHTML =
      deleteBtn +
      '<a href="/posts/' +
      post.id +
      '" class="notice-card__media">' +
      '<img src="' +
      imgSrc +
      '" alt="" class="notice-card__img work__img">' +
      '<span class="notice-card__badge">' +
      category +
      "</span>" +
      '<span class="notice-card__overlay">View Details →</span></a>' +
      '<div class="notice-card__body">' +
      '<h3 class="notice-card__title">' +
      (post.title || "Untitled") +
      "</h3>" +
      '<p class="notice-card__desc">' +
      desc +
      "</p>" +
      '<div class="notice-card__meta">' +
      '<a class="toggle-like-button" href="/likes/toggle/?id=' +
      post.id +
      '&type=Post" data-id="' +
      post.id +
      '" data-type="Post">' +
      '<span><i class="fas fa-heart"></i> ' +
      post.likesCount +
      " Likes</span></a>" +
      '<span><i class="fas fa-comment"></i> 0 Comments</span></div>' +
      '<div class="notice-card__footer">' +
      '<div class="notice-card__author">' +
      '<img src="/images/avatar7.png" alt="" class="notice-card__avatar">' +
      '<a href="/posts/' +
      post.id +
      '" class="notice-card__author-name">' +
      author +
      "</a></div>" +
      '<a href="/posts/' +
      post.id +
      '" class="notice-card__cta">View Details <i class="fas fa-arrow-right"></i></a></div></div>' +
      '<h3 class="work__title" hidden></h3><span class="work__button" hidden></span>' +
      '<div class="portfolio__item-details" hidden></div>';

    return card;
  }

  function buildCommentItem(comment, currentUserId) {
    var avatar = comment.user.avatar
      ? comment.user.avatar
      : "/images/avatar7.png";

    var deleteBtn =
      currentUserId && String(comment.user.id) === String(currentUserId)
        ? '<button type="button" class="post-comment__delete comment-delete-btn" data-comment-id="' +
          comment.id +
          '" title="Delete comment"><i class="uil uil-trash-alt"></i></button>'
        : "";

    var likeHtml = currentUserId
      ? '<a class="toggle-like-button post-comment__like" href="/likes/toggle/?id=' +
        comment.id +
        '&type=Comment"><i class="fas fa-heart"></i> ' +
        comment.likesCount +
        " Likes</a>"
      : '<span class="post-comment__like post-comment__like--static"><i class="fas fa-heart"></i> ' +
        comment.likesCount +
        " Likes</span>";

    var item = document.createElement("div");
    item.className = "post-comment comment-item";
    item.setAttribute("data-comment-id", comment.id);
    item.innerHTML =
      deleteBtn +
      '<img src="' +
      avatar +
      '" alt="" class="post-comment__avatar">' +
      '<div class="post-comment__body">' +
      '<div class="post-comment__head">' +
      '<strong class="post-comment__name">' +
      authorLabel(comment.user) +
      "</strong>" +
      '<time class="post-comment__time">' +
      formatDate(comment.createdAt) +
      "</time></div>" +
      '<p class="post-comment__text">' +
      comment.content +
      "</p>" +
      likeHtml +
      "</div>";

    return item;
  }

  async function deletePost(postId) {
    const dlg = window.cmDialog;
    const ok = dlg
      ? await dlg.confirm({
          title: "Delete notice?",
          message: "This notice will be permanently removed. This cannot be undone.",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          variant: "danger",
        })
      : false;
    if (!ok) return;

    axios
      .get("/posts/destroy/" + postId, { headers: JSON_HEADERS })
      .then(function (res) {
        var card = document.querySelector(
          '[data-post-id="' + res.data.postId + '"]'
        );
        if (card) {
          if (window.mixerBlog) {
            window.mixerBlog.remove(card);
          } else {
            card.remove();
          }
        }
        notify(res.data.message, "success");
      })
      .catch(function (err) {
        notify(
          (err.response && err.response.data && err.response.data.message) ||
            "Could not delete notice",
          "error"
        );
      });
  }

  async function deleteComment(commentId) {
    const dlg = window.cmDialog;
    const ok = dlg
      ? await dlg.confirm({
          title: "Delete comment?",
          message: "This comment will be permanently removed. This cannot be undone.",
          confirmLabel: "Delete",
          cancelLabel: "Cancel",
          variant: "danger",
        })
      : false;
    if (!ok) return;

    axios
      .get("/comments/destroy/" + commentId, { headers: JSON_HEADERS })
      .then(function (res) {
        var item = document.querySelector(
          '.comment-item[data-comment-id="' + res.data.commentId + '"]'
        );
        if (item) item.remove();
        notify(res.data.message, "success");
      })
      .catch(function (err) {
        notify(
          (err.response && err.response.data && err.response.data.message) ||
            "Could not delete comment",
          "error"
        );
      });
  }

  function likeCountLabel(count) {
    return count + (count === 1 ? " Like" : " Likes");
  }

  function updateLikeCount(link, count) {
    if (!link) return;
    var label = likeCountLabel(count);

    var countSpan = link.querySelector("span");
    if (countSpan) {
      if (countSpan.querySelector("i")) {
        countSpan.innerHTML = '<i class="fas fa-heart"></i> ' + label;
      } else {
        countSpan.textContent = label;
      }
      return;
    }

    var h5 = link.querySelector("h5");
    if (h5) {
      h5.textContent = label;
      return;
    }

    var icon = link.querySelector("i");
    if (icon) {
      link.innerHTML = icon.outerHTML + " " + label;
      return;
    }

    link.textContent = label;
  }

  function toggleLike(link) {
    axios
      .get(link.getAttribute("href"), { headers: JSON_HEADERS })
      .then(function (res) {
        updateLikeCount(link, res.data.likesCount);
        notify(res.data.message, "success");
      })
      .catch(function (err) {
        notify(
          (err.response && err.response.data && err.response.data.message) ||
            "Could not update like",
          "error"
        );
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var createPostForm = document.getElementById("create-post-form");
    if (createPostForm) {
      createPostForm.addEventListener("submit", function (e) {
        e.preventDefault();

        if (
          typeof window.__validateNoticeForm === "function" &&
          !window.__validateNoticeForm(createPostForm)
        ) {
          return;
        }

        var submitBtn = createPostForm.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add("is-loading");
        }

        axios
          .post("/posts/create", new FormData(createPostForm), {
            headers: JSON_HEADERS,
          })
          .then(function (res) {
            var grid = document.getElementById("posts-grid");
            var card = buildPostCard(
              res.data.post,
              createPostForm.getAttribute("data-user-id")
            );

            if (grid) {
              if (window.mixerBlog) {
                window.mixerBlog.insert(card);
              } else {
                grid.insertBefore(card, grid.firstChild);
              }
            }

            createPostForm.reset();
            if (typeof window.__resetNoticeDropzone === "function") {
              window.__resetNoticeDropzone();
            }
            createPostForm.querySelectorAll(".cm-field").forEach(function (f) {
              f.classList.remove("has-value", "is-active", "is-error");
            });
            notify(res.data.message, "success");
          })
          .catch(function (err) {
            notify(
              (err.response && err.response.data && err.response.data.message) ||
                "Could not create notice",
              "error"
            );
          })
          .finally(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.classList.remove("is-loading");
            }
          });
      });
    }

    var createCommentForm = document.getElementById("create-comment-form");
    if (createCommentForm) {
      createCommentForm.addEventListener("submit", function (e) {
        e.preventDefault();

        var textarea = createCommentForm.querySelector('textarea[name="content"]');
        if (!textarea || !textarea.value.trim()) {
          notify("Please enter a comment", "error");
          return;
        }

        var submitBtn = createCommentForm.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        var payload = new URLSearchParams();
        payload.append(
          "post",
          createCommentForm.querySelector('[name="post"]').value
        );
        payload.append("content", textarea.value.trim());

        axios
          .post("/comments/create", payload, {
            headers: Object.assign({}, JSON_HEADERS, {
              "Content-Type": "application/x-www-form-urlencoded",
            }),
          })
          .then(function (res) {
            var list = document.getElementById("comments-list");
            var item = buildCommentItem(
              res.data.comment,
              createCommentForm.getAttribute("data-user-id")
            );
            if (list) {
              var emptyMsg = list.querySelector(".post-detail__empty");
              if (emptyMsg) emptyMsg.remove();
              list.appendChild(item);
              var titleEl = document.querySelector(".post-detail__section-title");
              if (titleEl) {
                var n = list.querySelectorAll(".post-comment").length;
                titleEl.textContent = "Comments (" + n + ")";
              }
              item.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
            createCommentForm.reset();
            notify(res.data.message, "success");
          })
          .catch(function (err) {
            var msg =
              (err.response && err.response.data && err.response.data.message) ||
              "Could not add comment";
            if (!err.response && err.message) msg = err.message;
            notify(msg, "error");
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    }
  });

  document.addEventListener("click", function (e) {
    var likeLink = e.target.closest(".toggle-like-button");
    if (likeLink) {
      e.preventDefault();
      toggleLike(likeLink);
      return;
    }

    var deletePostBtn = e.target.closest(".post-delete-btn");
    if (deletePostBtn) {
      e.preventDefault();
      deletePost(deletePostBtn.getAttribute("data-post-id"));
      return;
    }

    var deleteCommentBtn = e.target.closest(".comment-delete-btn");
    if (deleteCommentBtn) {
      e.preventDefault();
      deleteComment(deleteCommentBtn.getAttribute("data-comment-id"));
    }
  });
})();
