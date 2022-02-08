/* global MutationObserver, fetch */

import localforage from 'localforage'

const avatarDimensions = {
  forum: 80,
  nexus: 48,
  liker: 24,
  notifAndMenuTabs: 20
}

const style = document.createElement('style')
style.id = 'avaReviveStyle'
style.innerText = `
.revived { filter: drop-shadow(0 0 2px black); }`
document.body.append(style)

const ongoingFetches = {}

localforage.getItem('knownAvatars').then(
  (knownAvatars) => {
    if (!knownAvatars) knownAvatars = {}

    /**
     * find a post's avatar
     *
     * @param {string} user the id of the user to find the avatar of
     * @returns {string | null} url if a new url is found
     */
    const findAvatar = async (user) => {
      // if the avatar is already being fetched:
      if (ongoingFetches[user]) return await ongoingFetches[user]

      // register ongoing fetch:
      let resolveP
      ongoingFetches[user] = new Promise((resolve) => {
        resolveP = resolve
        setTimeout(() => { // de-register after 30sec
          if (!ongoingFetches[user].resolved) resolve(null) // <- resolve to null if somehow not resolved
          ongoingFetches[user] = undefined
        }, 30000)
      })

      // fetch:
      const profileRequest = await fetch(`https://twinoid.com/user/${user}`)
      const profileText = await profileRequest.text()
      const profilePage = document.createElement('html')
      profilePage.innerHTML = profileText

      const firstLink = profilePage.querySelector('.tid_details .tid_userStatus a')
      const url = firstLink ? firstLink.href : null

      if (url) {
        if (url !== knownAvatars[user]) knownAvatars[user] = url
        else {
          resolveP(null)
          return null // return null if did not change
        }
      }

      localforage.setItem('knownAvatars', knownAvatars)
      resolveP(url)
      return url
    }

    /**
     * create an avatar container for the Nexus if needed, then append it
     *
     * @param {Element} post the post that is being revived
     * @returns {Element} the element where the revived avatar will be inserted
     */
    const makeNexusContainer = post => {
      const existingDiv = post.getElementsByClassName('tid_twinoidAvatar')[0]

      let containerTd
      if (existingDiv.classList.contains('tid_default')) {
        const containerTable = document.createElement('table')
        const containerTbody = document.createElement('tbody')
        const containerTr = document.createElement('tr')
        containerTd = document.createElement('td')

        containerTd.style.width = '48px'
        containerTd.style.height = '24px'

        containerTr.append(containerTd)
        containerTbody.append(containerTr)
        containerTable.append(containerTbody)

        existingDiv.lastChild.remove()
        existingDiv.append(containerTable)
      } else {
        containerTd = existingDiv.getElementsByTagName('td')[0]
      }

      containerTd.style.setProperty('background-color', 'transparent', 'important')
      containerTd.style.boxShadow = 'none'

      existingDiv.style.backgroundColor = 'transparent'
      existingDiv.style.boxShadow = 'none'
      return containerTd
    }

    /**
     * get the avatar and set if found
     *
     * @param {Element} post the post to revive
     * @param {string} user user ID
     */
    const revive = async (post, user) => {
      const avatarUrl = await findAvatar(user)

      if (!avatarUrl) return

      reviveFast(post, user)
    }

    /**
     * change avatar from memory
     *
     * @param {Element} post the post where the avatar is located
     * @param {string} user user ID
     */
    const reviveFast = async (post, user) => {
      const forumAvaContainer = post.getElementsByClassName('tid_floatBox')

      let containerType
      if (forumAvaContainer.length) {
        containerType = 'forum'
      } else if (post.classList.contains('tid_liker')) {
        containerType = 'liker'
      } else {
        containerType = 'nexus'
        // check for special cases
        if (post.getElementsByClassName('tid_twinoidAvatar')[0].style.maxHeight === '20px') containerType = 'notifAndMenuTabs'
      }

      let avaContainer
      if (containerType === 'forum') {
        avaContainer = forumAvaContainer[0]
      } else {
        avaContainer = makeNexusContainer(post)
      }

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

      const dims = avatarDimensions[containerType]
      revived.style.maxWidth = dims + 'px'
      revived.style.maxHeight = dims + 'px'
      if (containerType === 'forum') revived.classList.add('revived')

      while (avaContainer.children.length) avaContainer.lastChild.remove()
      avaContainer.append(revived)
    }

    /**
     * look for new forum and nexus post/comment headers and nexus likes and
     * send for revival all that have not been revived
     */
    const watch = () => {
      const o = new MutationObserver(async () => {
        const mainAvatarEl = document.querySelector('.tid_actions a') // avatar inside notification panel
        if (!mainAvatarEl) return
        const loggedUser = mainAvatarEl.href.split('/')[4]

        o.disconnect()

        // Handle normal posts:
        const posts = [
          ...document.querySelectorAll('[id^=tid_forumPost]'), // forums posts
          ...document.querySelectorAll('.tid_wallEvent:not(.tid_likeOnly)'), // nexus posts
          ...document.getElementsByClassName('tid_comment'), // nexus comments
          ...document.getElementsByClassName('tid_liker') // nexus likes
        ]
        for (const post of posts) {
          if (!post.classList.contains('parsed')) {
            post.classList.add('parsed')

            const userElem = post.getElementsByClassName('tid_user')[0]

            const isLiker = post.classList.contains('tid_liker')
            if (!userElem && !isLiker) {
              if (post.classList.contains('tid_comment')) {
                // assume that an ID-less comment is a logged user comment
                if (loggedUser in knownAvatars) reviveFast(post, loggedUser)
                revive(post, loggedUser)
              }
              continue // <- continue gracefully if data is not found
            }

            const user = isLiker
              ? post.getAttribute('tid_id')
              : userElem.getAttribute('tid_id')
            if (user in knownAvatars) reviveFast(post, user) // do fast if possible
            revive(post, user) // do slow anyways to check if url changed
          }
        }

        // Handle the current user's avatars in special places:
        const userAvatars = [
          document.querySelectorAll('ul.menu li')[7], // <- "my profile" tab
          document.getElementById('tid_openRight'), // <- top right notification area
          mainAvatarEl
        ]
        const newNexusPost = document.getElementsByClassName('tid_newPost')
        if (newNexusPost.length) {
          userAvatars.push(newNexusPost[0])
        }
        for (const element of userAvatars) {
          if (element && !element.classList.contains('parsed')) {
            element.classList.add('parsed')
            if (loggedUser in knownAvatars) reviveFast(element, loggedUser) // do fast if possible
            revive(element, loggedUser) // do slow anyways to check if url changed
          }
        }

        // reconnect observer:
        o.observe(
          document.getElementById('tid_forum_right') ||
          document.getElementsByClassName('tid_wallEvents')[0] ||
          document.getElementsByClassName('tid_module')[0],
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
