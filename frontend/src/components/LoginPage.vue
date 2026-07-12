<template>
  <div class="login-container">
    <div class="login-locale-bar">
      <LocaleSwitcher />
    </div>
    <div class="slider">
      <!-- 登录表单 -->
      <div :class="active === 1 ? 'form' : 'form hidden'">
        <div class="title"><span>{{ $t('login.welcomeBack') }}</span></div>
        <div class="subtitle">{{ $t('login.pleaseLogin') }}</div>
        <div class="inputf">
          <input type="text" v-model="loginUsername" :placeholder="$t('login.username')" />
          <span class="label">{{ $t('login.username') }}</span>
        </div>
        <div class="inputf">
          <input type="password" v-model="loginPassword" :placeholder="$t('login.password')" />
          <span class="label">{{ $t('login.password') }}</span>
        </div>
        <button @click="handleLogin">{{ $t('login.login') }}</button>
        <p v-if="loginError" class="error">{{ loginError }}</p>
      </div>

      <!-- 注册表单 -->
      <div :class="active === 2 ? 'form' : 'form hidden'">
        <div class="subtitle">{{ $t('login.pleaseRegister') }}</div>
        <div class="inputf">
          <input type="text" :placeholder="$t('login.username')" v-model="registerUsername" />
          <span class="label">{{ $t('login.username') }}</span>
        </div>
        <div class="inputf">
          <input type="password" :placeholder="$t('login.password')" v-model="registerPassword" />
          <span class="label">{{ $t('login.password') }}</span>
        </div>
        <div class="inputf">
          <input type="text" :placeholder="$t('login.email')" v-model="registerEmail" />
          <span class="label">{{ $t('login.email') }}</span>
        </div>
        <div class="inputf">
          <input type="text" :placeholder="$t('login.phoneNumber')" v-model="registerPhoneNumber" />
          <span class="label">{{ $t('login.phoneNumber') }}</span>
        </div>
        <button @click="handleRegister">{{ $t('login.register') }}</button>
        <p v-if="registerError" class="error">{{ registerError }}</p>
        <p v-if="registerSuccess" class="success">{{ registerSuccess }}</p>
      </div>

      <!-- 卡片表单 -->
      <div :class="active === 1 ? 'card' : 'card active'">
        <div class="head">
          <div class="name"><span>{{ $t('common.appTitle') }}</span></div>
        </div>
        <div class="desc">
          {{ $t('login.platformDescription') }}
        </div>
        <div class="btn">
          {{ active === 1 ? $t('login.newUser') : $t('login.hasAccount') }}
          <button @click="toggleActive">
            {{ active === 1 ? $t('login.goRegister') : $t('login.goLogin') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { useI18n } from '@/i18n';
import LocaleSwitcher from './LocaleSwitcher.vue';

const { t } = useI18n();

const active = ref(1);
const loginUsername = ref("");
const loginPassword = ref("");
const loginError = ref("");

const registerUsername = ref("");
const registerPassword = ref("");
const registerEmail = ref("");
const registerPhoneNumber = ref("");
const registerError = ref("");
const registerSuccess = ref("");

const router = useRouter();

const toggleActive = () => {
  active.value = active.value === 1 ? 2 : 1;
};

const handleLogin = async () => {
  if (!loginUsername.value || !loginPassword.value) {
    loginError.value = t('login.errors.emptyFields');
    return;
  }

  try {
    const response = await axios.post("http://localhost:3000/api/login", {
      username: loginUsername.value,
      password: loginPassword.value,
    });

    if (response.data.success) {
      router.push("/cesium");
    } else {
      loginError.value = response.data.message;
    }
  } catch (error) {
    console.error("Login request failed:", error);
    loginError.value = t('login.errors.serverError');
  }
};

const emailRegex = /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/;
const phoneRegex = /^\d{10,11}$/;

const handleRegister = async () => {
  if (!registerUsername.value || !registerPassword.value) {
    registerError.value = t('login.errors.emptyFields');
    return;
  }
  if (!emailRegex.test(registerEmail.value)) {
    registerError.value = t('login.errors.invalidEmail');
    return;
  }
  if (!phoneRegex.test(registerPhoneNumber.value)) {
    registerError.value = t('login.errors.invalidPhone');
    return;
  }
  try {
    const response = await axios.post("http://localhost:3000/api/register", {
      username: registerUsername.value,
      password: registerPassword.value,
      email: registerEmail.value,
      phone_number: registerPhoneNumber.value,
    });
    if (response.data.success) {
      registerSuccess.value = response.data.message;
      registerError.value = "";
    } else {
      registerError.value = response.data.message;
      registerSuccess.value = "";
    }
  } catch (error) {
    console.error("Registration request failed:", error);
    registerError.value = t('login.errors.serverError');
    registerSuccess.value = "";
  }
};
</script>

<style scoped>
.login-locale-bar {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 100;
}

.login-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: url("@/assets/back.jpg") no-repeat center center;
  background-size: cover;
}

.login-container .slider {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-container .slider .form {
  width: 350px;
  height: 500px;
  background: rgba(62, 200, 255, 0.85);
  backdrop-filter: blur(16px) saturate(0);
  border-radius: 10px;
  padding: 40px 60px;
  box-shadow: rgba(50, 50, 93, 0.25) 50px 50px 100px -20px,
    rgba(0, 0, 0, 0.5) 30px 30px 60px -30px,
    rgba(212, 217, 222, 0.35) 2px -2px 6px 0px inset;
  display: flex;
  justify-content: center;
  flex-direction: column;
  margin: 0;
  z-index: 3;
  transition: 0.25s ease-in-out;
}

.login-container .slider .form.hidden {
  height: 395px;
  box-shadow: none;
  z-index: 1;
}

.login-container .slider .form .title {
  font-size: 50px;
  color: rgb(1, 1, 1);
  letter-spacing: 10px;
  font-weight: 300;
  margin-bottom: 50px;
  margin-right: 0px;
  margin-top: 30px;
  display: flex;
  justify-content: center;
}

.login-container .slider .form .subtitle {
  font-size: 30px;
  color: rgb(0, 0, 0);
  letter-spacing: 5px;
  margin-bottom: 50px;
  display: flex;
  justify-content: center;
}

.login-container .slider .form .inputf {
  width: 100%;
  position: relative;
  margin-bottom: 35px;
}

.login-container .slider .form .inputf input {
  width: 100%;
  height: 35px;
  border: none;
  outline: 1.5px solid rgb(237, 237, 241);
  background: transparent;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 15px;
  color: rgb(0, 0, 0);
}

.login-container .slider .form .inputf input::placeholder {
  color: rgb(239, 242, 246);
}

.login-container .slider .form .inputf input:focus {
  outline: 1.5px solid rgb(0, 0, 0);
}

.login-container .slider .form .inputf input:focus::placeholder {
  opacity: 0;
}

.login-container .slider .form .inputf input:not(:placeholder-shown) + .label,
.login-container .slider .form .inputf input:focus + .label {
  opacity: 1;
  top: -20px;
}

.login-container .slider .form .inputf .label {
  position: absolute;
  top: 0;
  left: 0;
  color: rgb(0, 0, 0);
  font-size: 15px;
  font-weight: bold;
  transition: 0.25s ease-out;
  opacity: 0;
}

.login-container .slider .form button {
  width: 30%;
  height: 35px;
  margin: 0 auto;
  background: rgb(202, 254, 255);
  color: #000000;
  border: none;
  outline: none;
  border-radius: 5px;
  font-weight: bold;
  font-size: 15px;
  cursor: pointer;
  letter-spacing: 5px;
}

.login-container .slider .form button:hover {
  transform: scale(1.15);
  color: #000000;
  box-shadow: 0 0 10px rgb(99, 255, 255);
}

.login-container .slider .card {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translate(0, -50%);
  width: 420px;
  height: 400px;
  background: rgb(200, 222, 255);
  background-size: contain;
  padding: 40px;
  border-radius: 0 10px 10px 0;
  transition: 0.5s ease-in-out;
  z-index: 2;
}

.login-container .slider .card.active {
  right: calc(100% - 500px);
  border-radius: 10px 0 0 10px;
}

.login-container .slider .card .head {
  font-size: 34px;
  margin-bottom: 35px;
  display: flex;
  justify-content: center;
}

.login-container .slider .card .head .name {
  font-weight: 300;
}

.login-container .slider .card .head .name span {
  color: rgb(0, 0, 0);
  font-weight: bold;
}

.login-container .slider .card .desc {
  font-size: 18px;
  text-align: justify;
  margin-bottom: 40px;
  margin-top: 50px;
  font-weight: bold;
}

.login-container .slider .card .btn {
  font-size: 15px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-container .slider .card .btn button {
  background: rgb(202, 254, 255);
  font-size: 15px;
  padding: 5px 15px;
  border: none;
  outline: none;
  border-radius: 5px;
  cursor: pointer;
  margin-left: 10px;
  letter-spacing: 1px;
}

.login-container .slider .card .btn button:hover {
  transform: scale(1.15);
  color: #000000;
  box-shadow: 0 0 10px rgb(99, 255, 255);
}

.desc {
  font-size: 16px;
  color: #333;
  line-height: 1.6;
  text-align: justify;
  text-justify: inter-word;
  margin: 2px;
  padding: 1px;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  text-indent: 2em;
}

.error {
  color: rgb(255, 40, 40);
  font-size: 17px;
  margin-top: 13px;
  font-weight: bold;
  text-align: center;
}

.success {
  color: green;
  font-size: 17px;
  margin-top: 13px;
  font-weight: bold;
  text-align: center;
}
</style>
