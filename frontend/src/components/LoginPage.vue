<template>
  <div class="login-container">
    <div class="slider">
      <!-- 登录表单 -->
      <div :class="active === 1 ? 'form' : 'form hidden'">
        <div class="title"><span>欢迎回来</span></div>
        <div class="subtitle">请登录您的账户</div>
        <!-- 用户名输入框 -->
        <div class="inputf">
          <input type="text" v-model="loginUsername" placeholder="用户名" />
          <span class="label">用户名</span>
        </div>
        <!-- 密码输入框 -->
        <div class="inputf">
          <input type="password" v-model="loginPassword" placeholder="密码" />
          <span class="label">密码</span>
        </div>
        <!-- 登录按钮，点击触发 handleLogin 方法 -->
        <button @click="handleLogin">登录</button>
        <!-- 登录错误信息 -->
        <p v-if="loginError" class="error">{{ loginError }}</p>
      </div>

      <!-- 注册表单 -->
      <div :class="active === 2 ? 'form' : 'form hidden'">
        <div class="subtitle">请创建您的账户</div>
        <!-- 用户名输入框 -->
        <div class="inputf">
          <input type="text" placeholder="用户名" v-model="registerUsername" />
          <span class="label">用户名</span>
        </div>
        <!-- 密码输入框 -->
        <div class="inputf">
          <input
            type="password"
            placeholder="密码"
            v-model="registerPassword"
          />
          <span class="label">密码</span>
        </div>
        <!-- 邮箱输入框 -->
        <div class="inputf">
          <input type="text" placeholder="邮箱" v-model="registerEmail" />
          <span class="label">邮箱</span>
        </div>
        <!-- 联系方式输入框 -->
        <div class="inputf">
          <input
            type="text"
            placeholder="联系方式"
            v-model="registerPhoneNumber"
          />
          <span class="label">联系方式</span>
        </div>

        <!-- 注册按钮，点击触发 handleRegister 方法 -->
        <button @click="handleRegister">注册</button>
        <p v-if="registerError" class="error">{{ registerError }}</p>
        <p v-if="registerSuccess" class="success">{{ registerSuccess }}</p>
      </div>

      <!-- 卡片表单，用于切换登录和注册视图 -->
      <div :class="active === 1 ? 'card' : 'card active'">
        <div class="head">
          <div class="name"><span>碳中和时空大数据平台</span></div>
        </div>
        <div class="desc">
          《中国共产党第二十次代表大会报告》提出了积极稳妥推进碳达峰、碳中和的目标，将双碳目标视为生态文明建设的重要组成部分。碳中和是指通过减少温室气体排放和增加碳吸收，使人类活动产生的二氧化碳净排放量为零。实现碳中和在应对气候变化、保护生态环境、实现可持续发展中具有重要意义。
        </div>
        <!-- 切换按钮 -->
        <div class="btn">
          {{ active === 1 ? "新用户 ?" : "已有账号" }}
          <button @click="toggleActive">
            {{ active === 1 ? "去注册 " : "去登录" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 引入 Vue 的 ref 函数，用于创建响应式数据
import { ref } from "vue";
// 引入 axios 用于 HTTP 请求
import axios from "axios";
import { useRouter } from "vue-router"; // 引入 useRouter

// 创建响应式数据
const active = ref(1); // 用于切换登录和注册表单的状态，1 表示登录，2 表示注册
// 登录表单的变量
const loginUsername = ref("");
const loginPassword = ref("");
const loginError = ref("");

// 注册表单的变量
const registerUsername = ref("");
const registerPassword = ref("");
const registerEmail = ref("");
const registerPhoneNumber = ref("");
const registerError = ref("");
const registerSuccess = ref("");

const router = useRouter(); // 使用 useRouter 获取 router 对象

// 切换登录和注册表单的方法
const toggleActive = () => {
  active.value = active.value === 1 ? 2 : 1; // 切换 active 的值，1 切换到 2，2 切换到 1
};

// 登录处理函数
const handleLogin = async () => {
  if (!loginUsername.value || !loginPassword.value) {
    loginError.value = "用户名和密码不能为空";
    return;
  }

  try {
    // 发送 POST 请求到后端 API 进行登录
    const response = await axios.post("http://localhost:3000/api/login", {
      username: loginUsername.value,
      password: loginPassword.value,
    });

    // 根据后端的响应处理结果
    if (response.data.success) {
      // 跳转到cesium界面
      router.push("/cesium"); // 使用 router 进行导航
    } else {
      loginError.value = response.data.message; // 登录失败，显示错误信息
    }
  } catch (error) {
    console.error("登录请求失败:", error);
    loginError.value = "服务器错误，请稍后再试"; // 处理请求错误
  }
};

// 邮箱和电话号码的正则表达式
const emailRegex = /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/;
const phoneRegex = /^\d{10,11}$/;

// 注册处理函数
const handleRegister = async () => {
  if (!registerUsername.value || !registerPassword.value) {
    registerError.value = "用户名和密码不能为空";
    return;
  }
  // 检查邮箱格式
  if (!emailRegex.test(registerEmail.value)) {
    registerError.value = "请输入正确的邮箱地址";
    return;
  }
  // 检查电话号码格式
  if (!phoneRegex.test(registerPhoneNumber.value)) {
    registerError.value = "请输入正确的电话号码";
    return;
  }
  try {
    // 发送 POST 请求到后端 API 进行注册
    const response = await axios.post("http://localhost:3000/api/register", {
      username: registerUsername.value,
      password: registerPassword.value,
      email: registerEmail.value,
      phone_number: registerPhoneNumber.value,
    });
    // 根据后端的响应处理结果
    if (response.data.success) {
      registerSuccess.value = response.data.message; // 注册成功提示
      registerError.value = ""; // 清除错误信息
    } else {
      registerError.value = response.data.message; // 注册失败，显示错误信息
      registerSuccess.value = ""; // 清除成功信息
    }
  } catch (error) {
    console.error("注册请求失败:", error);
    registerError.value = "服务器错误，请稍后再试";
    registerSuccess.value = ""; // 清除成功信息
  }
};
</script>

<style scoped>
/* 容器样式，设置宽度、最小高度、居中显示，背景图片及其样式 */
.login-container {
  width: 100%; /* 设置宽度为视口的100% */
  min-height: 100vh; /* 设置最小高度为视口高度，保证至少覆盖整个视口 */
  display: flex; /* 使用Flexbox布局 */
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  background: url("@/assets/back.jpg") no-repeat center center; /* 设置背景图片，并确保图片不重复且居中显示 */
  background-size: cover; /* 背景图片覆盖整个容器 */
}

/* 内层滑动容器，用于承载表单和卡片 */
.login-container .slider {
  position: relative; /* 相对定位，便于内部绝对定位的元素定位 */
  display: flex; /* 使用Flexbox布局 */
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
}

/* 表单容器样式，定义尺寸、背景、边框、内边距等 */
.login-container .slider .form {
  width: 350px; /* 宽度 */
  height: 500px; /* 高度 */
  background: rgba(62, 200, 255, 0.85); /* 半透明背景 */
  backdrop-filter: blur(16px) saturate(0); /* 背景模糊效果 */
  border-radius: 10px; /* 圆角边框 */
  /*border: 1px solid rgba(255, 255, 255, 0.15); /* 边框样式 */
  padding: 40px 60px; /* 内边距 */
  box-shadow: rgba(50, 50, 93, 0.25) 50px 50px 100px -20px,
    rgba(0, 0, 0, 0.5) 30px 30px 60px -30px,
    rgba(212, 217, 222, 0.35) 2px -2px 6px 0px inset; /* 复合阴影效果 */
  display: flex; /* 使用Flexbox布局 */
  justify-content: center; /* 水平居中 */
  flex-direction: column; /* 设置为纵向布局 */
  margin: 0; /* 外边距 */
  z-index: 3; /* 层级 */
  transition: 0.25s ease-in-out; /* 过渡效果 */
}

/* 隐藏状态的表单样式 */
.login-container .slider .form.hidden {
  height: 395px; /* 高度减小 */
  box-shadow: none; /* 移除阴影 */
  z-index: 1; /* 降低层级 */
}

/* 标题样式 */
.login-container .slider .form .title {
  font-size: 50px; /* 字号 */
  color: rgb(1, 1, 1); /* 字体颜色 */
  letter-spacing: 10px; /* 字间距 */
  font-weight: 300; /* 字重 */
  margin-bottom: 50px; /* 下外边距 */
  margin-right: 0px;
  margin-top: 30px;
  display: flex;
  justify-content: center;/* 设置上下外边距为0，左右外边距为自动，实现居中 */
}

/* 副标题样式 */
.login-container .slider .form .subtitle {
  font-size: 30px; /* 字号 */
  color: rgb(0, 0, 0); /* 字体颜色 */
  letter-spacing: 5px; /* 字间距 */
  margin-bottom: 50px; /* 下外边距 */
  display: flex;
  justify-content: center; /* 只将文本内容居中，不影响其他布局 */
}

/* 输入字段容器 */
.login-container .slider .form .inputf {
  width: 100%; /* 宽度 */
  position: relative; /* 相对定位 */
  margin-bottom: 35px; /* 下外边距 */
}

/* 输入框样式 */
.login-container .slider .form .inputf input {
  width: 100%; /* 宽度 */
  height: 35px; /* 高度 */
  border: none; /* 无边框 */
  outline: 1.5px solid rgb(237, 237, 241); /* 轮廓样式 */
  background: transparent; /* 透明背景 */
  border-radius: 8px; /* 圆角 */
  font-size: 12px; /* 字号 */
  padding: 0 15px; /* 内边距 */
  color: rgb(0, 0, 0); /* 字体颜色 */
}

/* 输入框占位符样式 */
.login-container .slider .form .inputf input::placeholder {
  color: rgb(239, 242, 246); /* 占位符颜色 */
}

/* 输入框聚焦样式 */
.login-container .slider .form .inputf input:focus {
  outline: 1.5px solid rgb(0, 0, 0); /* 聚焦时的轮廓样式 */
}

/* 聚焦时隐藏占位符 */
.login-container .slider .form .inputf input:focus::placeholder {
  opacity: 0; /* 透明度 */
}

/* 输入框非空或聚焦时标签样式 */
.login-container .slider .form .inputf input:not(:placeholder-shown) + .label,
.login-container .slider .form .inputf input:focus + .label {
  opacity: 1; /* 透明度 */
  top: -20px; /* 顶部位置 */
}

/* 标签基本样式 */
.login-container .slider .form .inputf .label {
  position: absolute; /* 绝对定位 */
  top: 0; /* 顶部位置 */
  left: 0; /* 左侧位置 */
  color: rgb(0, 0, 0); /* 字体颜色 */
  font-size: 15px; /* 字号 */
  font-weight: bold; /* 字重 */
  transition: 0.25s ease-out; /* 过渡效果 */
  opacity: 0; /* 默认透明 */
}

/* 按钮样式 */
.login-container .slider .form button {
  width: 30%; /* 宽度 */
  height: 35px; /* 高度 */
  margin: 0 auto; /* 设置上下外边距为0，左右外边距为自动，实现居中 */
  background: rgb(202, 254, 255); /* 背景色 */
  color: #000000; /* 字体颜色 */
  border: none; /* 无边框 */
  outline: none; /* 无轮廓 */
  border-radius: 5px; /* 圆角 */
  font-weight: bold; /* 字重 */
  font-size: 15px; /* 字号 */
  cursor: pointer; /* 鼠标样式 */
  letter-spacing: 5px; /* 字间距 */
}

/* 鼠标悬浮时的放大效果 */
.login-container .slider .form button:hover {
  transform: scale(1.15); /* 放大按钮 */
  color: #000000;
  box-shadow: 0 0 10px rgb(99, 255, 255); /* 添加更明显的阴影效果 */
}

/* 卡片样式，包括位置、大小、背景等 */
.login-container .slider .card {
  position: absolute; /* 绝对定位 */
  right: 0; /* 右侧位置 */
  top: 50%; /* 顶部偏移 */
  transform: translate(0, -50%); /* 转换，垂直居中 */
  width: 420px; /* 宽度 */
  height: 400px; /* 高度 */
  background: rgb(200, 222, 255); /* 背景图片 */
  background-size: contain; /* 背景大小 */
  padding: 40px; /* 内边距 */
  border-radius: 0 10px 10px 0; /* 圆角 */
  transition: 0.5s ease-in-out; /* 过渡效果 */
  z-index: 2; /* 层级 */
}

/* 激活状态的卡片样式 */
.login-container .slider .card.active {
  right: calc(100% - 500px); /* 右侧位置 */
  border-radius: 10px 0 0 10px; /* 圆角样式改变 */
}

/* 卡片头部样式 */
.login-container .slider .card .head {
  font-size: 34px; /* 字号 */
  margin-bottom: 35px; /* 下外边距 */
  display: flex;
  justify-content: center; /* 只将文本内容居中，不影响其他布局 */
}

/* 卡片头部名称样式 */
.login-container .slider .card .head .name {
  font-weight: 300; /* 字重 */
}

/* 卡片头部名称中span的样式 */
.login-container .slider .card .head .name span {
  color: rgb(0, 0, 0); /* 字体颜色 */
  font-weight: bold; /* 字重 */
}

/* 卡片描述文本样式 */
.login-container .slider .card .desc {
  font-size: 18px; /* 字号 */
  text-align: justify; /* 文本对齐 */
  margin-bottom: 40px; /* 下外边距 */
  margin-top: 50px;
  font-weight: bold;
}

/* 卡片按钮容器样式 */
.login-container .slider .card .btn {
  font-size: 15px; /* 字号 */
  font-weight: bold;
  display: flex; /* 使用 Flexbox */
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中（如果有多个元素或需要垂直居中时使用） */
}

/* 卡片按钮样式 */
.login-container .slider .card .btn button {
  background: rgb(202, 254, 255); /* 背景色 */
  font-size: 15px; /* 字号 */
  padding: 5px 15px; /* 内边距 */
  border: none; /* 无边框 */
  outline: none; /* 无轮廓 */
  border-radius: 5px; /* 圆角 */
  cursor: pointer; /* 鼠标样式 */
  margin-left: 10px; /* 左外边距 */
  letter-spacing: 1px; /* 字间距 */
}

/* 鼠标悬浮时的放大效果 */
.login-container .slider .card .btn button:hover {
  transform: scale(1.15); /* 放大按钮 */
  color: #000000;
  box-shadow: 0 0 10px rgb(99, 255, 255); /* 添加更明显的阴影效果 */
}

.desc {
  font-size: 16px; /* 设置字体大小 */
  color: #333; /* 设置字体颜色，深灰色更适合阅读 */
  line-height: 1.6; /* 增加行距，改善可读性 */
  text-align: justify; /* 两端对齐，使段落看起来更整洁 */
  text-justify: inter-word; /* 改善两端对齐的断字处理 */
  margin: 2px; /* 添加外边距，增加段落与其他元素的空间 */
  padding: 1px; /* 增加内边距，让文字不会直接贴近边框 */
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1); /* 轻微的阴影效果，增加立体感 */
  border-radius: 4px; /* 轻微的边角圆滑，显得更和谐 */
  text-indent: 2em; /* 设置首行缩进为2em；em是相对单位，基于当前字体尺寸 */
}

/* 错误信息样式 */
.error {
  color: rgb(255, 40, 40);
  font-size: 17px;
  margin-top: 13px;
  font-weight: bold;
  text-align: center;
}

/* 成功信息样式 */
.success {
  color: green;
  font-size: 17px;
  margin-top: 13px;
  font-weight: bold;
  text-align: center;
}
</style>
