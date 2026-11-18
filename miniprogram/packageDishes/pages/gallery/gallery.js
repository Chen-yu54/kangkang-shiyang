// 菜品大图查看 —— 分包 packageDishes 的唯一页面。
//
// 为什么要有一个页面：微信要求 subPackages[].pages 不能为空数组，
// 空数组会导致编译失败、模拟器起不来。图片本身放在分包能压主包体积，
// 但分包必须挂一个真实页面才合法。与其塞空占位页，不如做成能用的功能：
// 点菜品图进来全屏看，长按可保存。
//
// 入参：?src=<图片路径>&name=<菜名>&cuisine=<菜系>

Page({
  data: {
    src: '',
    name: '',
    cuisine: '',
    error: false,
  },

  onLoad(options) {
    const o = options || {};
    const src = o.src ? decodeURIComponent(o.src) : '';
    this.setData({
      src,
      name: o.name ? decodeURIComponent(o.name) : '',
      cuisine: o.cuisine ? decodeURIComponent(o.cuisine) : '',
      error: !src,
    });
  },

  // 图片加载失败：如实显示占位，不留白块
  onImageError() {
    this.setData({ error: true });
  },

  onTapBack() {
    wx.navigateBack();
  },

  // 长按保存到相册。失败时把原因说清楚，不静默
  onLongPress() {
    if (!this.data.src || this.data.error) return;
    wx.showLoading({ title: '保存中', mask: true });
    wx.downloadFile({
      url: this.data.src,
      success: (res) => {
        if (res.statusCode !== 200) {
          wx.hideLoading();
          wx.showToast({ title: '图片下载失败', icon: 'none' });
          return;
        }
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: (e) => {
            wx.hideLoading();
            // 用户拒绝授权时给可操作的提示，而不是一句「失败」
            const msg = String((e && e.errMsg) || '');
            if (msg.indexOf('auth deny') > -1 || msg.indexOf('authorize') > -1) {
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片需要你允许访问相册，可在右上角「…」→ 设置里打开。',
                showCancel: false,
              });
              return;
            }
            wx.showToast({ title: '保存失败', icon: 'none' });
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '图片下载失败', icon: 'none' });
      },
    });
  },
});
