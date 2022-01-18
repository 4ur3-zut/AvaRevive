/* global MutationObserver, fetch */

import localforage from 'localforage'

const avatarDimensions = {
  'forum': 80,
  'nexus': 48,
  'liker': 24
}

localforage.getItem('knownAvatars').then(
  (knownAvatars) => {
    if (!knownAvatars) knownAvatars = {}

    const style = document.createElement('style')
    style.id = 'avaReviveStyle'
    style.innerText = '.tid_content.tid_modinit { display: none!important; }'

    /**
     * create a new observer
     * 
     * @param {Element} element the element that needs to be observed
     */
    const createObserver = element => {
      const o = new MutationObserver(async () => {
        const posts = [
          ...document.getElementsByClassName('tid_comment')
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
      })
      o.observe(
        element,
        {childList: true}
      )
    }

    /**
     * find a post's avatar
     *
     * @param {string} user the id of the user to find the avatar of
     * @returns {string | null} url if a new url is found
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

      while (avaContainer.children.length) avaContainer.lastChild.remove()
      avaContainer.append(revived)
    }

    /**
     * look for new forum and nexus post/comment headers and nexus likes and
     * send for revival all that have not been revived
     */
    const watch = () => {
      const o = new MutationObserver(async () => {
        o.disconnect()
        const posts = [
          ...document.getElementsByClassName('tid_post'),
          ...document.querySelectorAll('.tid_wallEvent:not(.tid_likeOnly)'),
          ...document.getElementsByClassName('tid_comment'),
          ...document.getElementsByClassName('tid_liker')
        ]
        for (const post of posts) {
          const slow = []
          const fast = []
          if (!post.classList.contains('parsed')) {
            post.classList.add('parsed')

            const userElem = post.getElementsByClassName('tid_user')[0]

            const isLiker = post.classList.contains('tid_liker')
            if (!userElem && !isLiker) continue // <- continue gracefully if data is not found

            const user = isLiker ? post.getAttribute('tid_id') : userElem.getAttribute('tid_id')
            if (user in knownAvatars) fast.push([post, user]) // do fast if possible
            slow.push([post, user]) // do slows anyways to check if url changed

            for (const [p, u] of fast) reviveFast(p, u)
            for (const [p, u] of slow) revive(p, u)
          }

          if (post.classList.contains('tid_wallEvent')) {
            createObserver(post.children[1])
          }
        }
        o.observe(
          document.getElementById('tid_forum_right') || document.getElementsByClassName('tid_wallEvents')[0] || document.getElementsByClassName('tid_module')[0],
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
