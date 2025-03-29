<template>
  <div>
    <!-- 按钮组 -->
    <div class="homeBtn">
      <button id="about" class="homebtn" @click="showContent('about')">
        关于
      </button>
      <button id="service" class="homebtn" @click="showContent('service')">
        开发详情
      </button>
      <button id="login" class="homebtn" @click="redirectToLoginPage">
        登录和注册
      </button>
    </div>

    <div class="home">
      <button id="home" class="homeBTN" @click="showContent('Home')">
        返回
      </button>
    </div>

    <!-- 信息容器 -->
    <div class="info-container">
      <h2 align="center">碳中和时空大数据平台</h2>
      <hr />
      <div class="paragraph fade-in-out" :class="{ hidden: isHidden }">
        <!--使用for循环渲染每一段文字-->
        <p v-for="(line, index) in content" :key="index" class="text-line">
          {{ line }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import textContent from '@/assets/texts/content.json'

export default {
  name: "HomePage",
  data() {
    return {
      content: [],
      isHidden: false,
    };
  },
  methods: {
    showContent(type) {
      this.isHidden = true;
      setTimeout(() => {
        switch(type) {
          case 'about':
            this.content = textContent.about;
            break;
          case 'service':
            this.content = textContent.service;
            break;
          case 'Home':
          default:
            this.content = textContent.welcome;
        }
        this.isHidden = false;
      }, 500);
    },
    
    redirectToLoginPage() {
      this.$router.push("/login");
    },
  },
  mounted() {
    // 初始加载欢迎文本
    this.content = textContent.welcome;
  }
};
</script>

<style>
body {
  position: relative;
  background: url("@/assets/back.jpg") no-repeat center center;
  background-size: cover;
  background-attachment: fixed;
  background-position: center;
  margin: 0;
  padding: 0;
  font-family: "楷体", Times, serif;
}

.homeBtn {
  position: absolute;
  top: 20px;
  right: 5px;
  padding: 10px;
}

.homebtn {
  width: auto;
  height: auto;
  border: none;
  background: none;
  color: #ffffff;
  font-size: 35px;
  margin-bottom: 5px;
  margin-right: 50px;
  font-family: "楷体", Times, serif;
}

.homebtn:hover {
  color: #ffffff;
  transform: scale(1.1);
  text-decoration: underline;
}

.home {
  position: absolute;
  top: 720px;
  right: 8px;
  padding: 10px;
}

.homeBTN {
  font-size: 37px;
  border-radius: 20px;
  background: none;
  letter-spacing: 2px;
  color: #ffffff;
  font-family: "楷体", Times, serif;
}

.homeBTN:hover {
  color: #ffffff;
  transform: scale(1.1);
}

.info-container {
  position: fixed;
  top: 50%;
  right: 5%;
  transform: translate(-1%, -60%);
  background-color: transparent;
  padding: 20px;
  border-radius: 20px;
  width: 700px;
  height: 400px;
  max-width: 550px;
  text-align: left;
  color: white;
  font-family: "楷体", Times, serif;
}

.info-container h2 {
  font-size: 35px;
  margin-bottom: 15px;
  letter-spacing: 10px;
}

.paragraph {
  font-size: 20px;
  line-height: 1.5;
}

.text-line {
  text-indent: 2em; /* 为每个段落的首行设置缩进 */
  margin: 0 0 0.2em; /* 设置段落间距 */
}

/* 淡入淡出动画效果 */
.fade-in-out {
  opacity: 1;
  transition: opacity 0.5s ease-in-out;
}

.fade-in-out.hidden {
  opacity: 0;
}

.service-list {
  padding-left: 3em;
}

.service-item {
  margin-bottom: 0.5em;
}
</style>
