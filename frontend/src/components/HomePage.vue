<template>
  <div>
    <div class="locale-bar">
      <LocaleSwitcher />
    </div>
    <div class="homeBtn">
      <button id="about" class="homebtn" @click="showContent('about')">
        {{ $t('home.about') }}
      </button>
      <button id="service" class="homebtn" @click="showContent('service')">
        {{ $t('home.developmentDetails') }}
      </button>
      <button id="login" class="homebtn" @click="redirectToLoginPage">
        {{ $t('home.loginAndRegister') }}
      </button>
    </div>

    <div class="home">
      <button id="home" class="homeBTN" @click="showContent('Home')">
        {{ $t('home.back') }}
      </button>
    </div>

    <!-- 信息容器 -->
    <div class="info-container">
      <h2 align="center">{{ $t('common.appTitle') }}</h2>
      <hr />
      <div class="paragraph fade-in-out" :class="{ hidden: isHidden }">
        <p v-for="(line, index) in content" :key="index" class="text-line">
          {{ line }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import LocaleSwitcher from './LocaleSwitcher.vue';

export default {
  name: "HomePage",
  components: { LocaleSwitcher },
  data() {
    return {
      content: [],
      isHidden: false,
    };
  },
  methods: {
    showContent(type) {
      this.isHidden = true;
      const i18n = this.$i18n;
      setTimeout(() => {
        switch(type) {
          case 'about':
            this.content = i18n.t('home.aboutContent');
            break;
          case 'service':
            this.content = i18n.t('home.serviceContent');
            break;
          case 'Home':
          default:
            this.content = i18n.t('home.welcome');
        }
        this.isHidden = false;
      }, 500);
    },

    redirectToLoginPage() {
      this.$router.push("/login");
    },
  },
  mounted() {
    this.content = this.$i18n.t('home.welcome');
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

.locale-bar {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
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
