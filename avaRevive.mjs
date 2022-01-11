/* global MutationObserver, fetch */

import localforage from 'localforage'

localforage.getItem('knownAvatars').then(
  (knownAvatars) => {
    if (!knownAvatars) knownAvatars = {}

    const style = document.createElement('style')
    style.id = 'avaReviveStyle'
    style.innerText = '.tid_content.tid_modinit { display: none!important; }'

    /**
     * find a post's avatar
     * @param {*} user the id of the user to find the avatar of
     */
    const findAvatar = async (user) => {
      const profileRequest = await fetch(`https://twinoid.com/user/${user}`)
      const profileText = await profileRequest.text()
      const profilePage = document.createElement('html')
      profilePage.innerHTML = profileText

      const firstLink = profilePage.querySelector('.tid_details .tid_userStatus a')
      const url = firstLink ? firstLink.href : null

      if (url) {
        if (url !== knownAvatars[user]) knownAvatars[user] = url
        else return null // return null if did not change
      }

      localforage.setItem('knownAvatars', knownAvatars)

      return url
    }

    /**
     * get the avatar and set if found
     * @param {*} post the post to revive
     * @param {*} user user ID
     */
    const revive = async (post, user) => {
      const avatarUrl = await findAvatar(user)

      if (!avatarUrl) return

      reviveFast(post, user)
    }

    /**
     * change avatar from memory
     * @param {*} post the post where the avatar is located
     * @param {*} user user ID
     */
    const reviveFast = async (post, user) => {
      const avaContainer = post.querySelector('.tid_floatBox')
      const video = (knownAvatars[user].match(/.+\.(mp4|webm)$/) || [])[1]
      const revived = document.createElement(video ? 'video' : 'img')
      if (video) {
        revived.muted = true
        revived.disablepictureinpicture = true
        revived.loop = true
        revived.autoplay = true
        const source = document.createElement('source')
        source.src = knownAvatars[user]
        source.type = `video/${video}`
        revived.append(source)
      } else {
        revived.src = knownAvatars[user]
      }
      revived.style.maxWidth = '80px'
      revived.style.maxHeight = '80px'
      while (avaContainer.children.length) avaContainer.lastChild.remove()
      avaContainer.append(revived)
    }

    /**
     * look for new forum post headers and
     * send for revival all that have not been revived
     */
    const watch = () => {
      const o = new MutationObserver(async () => {
        o.disconnect()
        const posts = [
          ...document.getElementsByClassName('tid_post')
        ]
        for (const post of posts) {
          const slow = []
          const fast = []
          if (!post.classList.contains('parsed')) {
            post.classList.add('parsed')

            const userElem = post.getElementsByClassName('tid_user')[0]

            if (!userElem) continue // <- continue gracefully if data is not found

            const user = userElem.getAttribute('tid_id')
            if (user in knownAvatars) fast.push([post, user]) // do fast if possible
            slow.push([post, user]) // do slows anyways to check if url changed

            for (const [p, u] of fast) reviveFast(p, u)
            for (const [p, u] of slow) revive(p, u)
          }
        }
        o.observe(
          document.getElementById('tid_forum_right') || document.getElementsByClassName('tid_module')[0],
          { childList: true }
        )
      })
      o.observe(
        document.body,
        { childList: true }
      )
    }

    watch()
  }
)
