plugins { id("com.android.application") }

android {
    namespace = "com.mynamelancelot.wangleyou"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.mynamelancelot.wangleyou"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.0.1"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    signingConfigs {
        create("familyRelease") {
            val path = System.getenv("WANGLEYOU_ANDROID_KEYSTORE")
            if (!path.isNullOrBlank()) {
                val storePassword = System.getenv("WANGLEYOU_ANDROID_STORE_PASSWORD")
                    ?: error("WANGLEYOU_ANDROID_STORE_PASSWORD 未设置")
                val keyAlias = System.getenv("WANGLEYOU_ANDROID_KEY_ALIAS")
                    ?: error("WANGLEYOU_ANDROID_KEY_ALIAS 未设置")
                val keyPassword = System.getenv("WANGLEYOU_ANDROID_KEY_PASSWORD")
                    ?: error("WANGLEYOU_ANDROID_KEY_PASSWORD 未设置")
                storeFile = file(path)
                this.storePassword = storePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (!System.getenv("WANGLEYOU_ANDROID_KEYSTORE").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("familyRelease")
            }
        }
    }
}
