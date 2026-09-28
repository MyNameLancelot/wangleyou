package com.mynamelancelot.wangleyou;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.Keyframe;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.SystemClock;
import android.util.Property;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * 原生加载与故障覆盖层：奶油白纸张上摊开的一本相册。
 * 立体感来自书脊厚度、封面内侧衬页、翻页明暗与随动作变化的落影；书脊保持直立。
 */
final class StartupOverlay extends FrameLayout {
    private static final int PAPER = 0xfff7f5f0;
    private static final int INK = 0xff5b3943;
    /** 封面一次开合循环的时长。 */
    private static final long CYCLE = 3600L;
    /** 完全翻开的角度：接近平摊，看不到封面正面。 */
    private static final float OPEN_ANGLE = -168f;
    /** 打开过程的水平位移，让摊开的书仍居中。 */
    private static final float OPEN_SHIFT = 56f;
    private static final float ERROR_ANGLE = -30f;
    /** 冷启动至少展示到完全翻开并停稳，避免动画被切在半途。 */
    private static final long MIN_VISIBLE = (long) (CYCLE * 0.8f);

    private final View album;
    private final View albumShadow;
    private final FrameLayout cover;
    private final View coverFront;
    private final View coverLining;
    private final View coverShade;
    private final TextView title;
    private final View progressBar;
    private final View loadingText;
    private final View loadingFooter;
    private final View errorText;
    private final TextView skipButton;
    private ObjectAnimator coverAnimator;
    private ObjectAnimator frontAnimator;
    private ObjectAnimator liningAnimator;
    private ObjectAnimator shadeAnimator;
    private ObjectAnimator albumAnimator;
    private ObjectAnimator shadowAnimator;
    private ObjectAnimator progressAnimator;
    private long loadingStartedAt;
    private boolean minimumShown;
    private Runnable pendingComplete;
    private final Runnable fadeTask = this::fadeOut;

    StartupOverlay(Context context, Runnable retry) {
        super(context);
        setBackgroundColor(PAPER);
        setClickable(true);
        setClipChildren(false);

        LinearLayout center = new LinearLayout(context);
        center.setOrientation(LinearLayout.VERTICAL);
        center.setGravity(Gravity.CENTER_HORIZONTAL);
        center.setClipChildren(false);
        addView(center, new LayoutParams(-1, -2, Gravity.CENTER));

        FrameLayout stage = new FrameLayout(context);
        stage.setClipChildren(false);
        LinearLayout.LayoutParams stageParams = new LinearLayout.LayoutParams(dp(272), dp(176));
        stageParams.bottomMargin = dp(24);
        center.addView(stage, stageParams);

        albumShadow = new View(context);
        albumShadow.setBackground(round(dp(9), 0x476b5147, 0x006b5147));
        FrameLayout.LayoutParams shadowParams = new FrameLayout.LayoutParams(dp(200), dp(18), Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        stage.addView(albumShadow, shadowParams);

        FrameLayout albumBox = new FrameLayout(context);
        albumBox.setClipChildren(false);
        FrameLayout.LayoutParams albumParams = new FrameLayout.LayoutParams(dp(116), dp(143), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
        albumParams.topMargin = dp(4);
        stage.addView(albumBox, albumParams);
        album = albumBox;

        View board = new View(context);
        board.setBackground(round(dp(6), 0xff8a4457, 0xff5a3244));
        albumBox.addView(board, new FrameLayout.LayoutParams(-1, -1));

        FrameLayout pages = new FrameLayout(context);
        pages.setBackground(round(dp(6), 0xffe4d5b9, 0xfffbf3e3, 0xffdbcbab));
        FrameLayout.LayoutParams pagesParams = new FrameLayout.LayoutParams(-1, -1);
        pagesParams.setMargins(dp(12), dp(4), dp(3), dp(4));
        albumBox.addView(pages, pagesParams);
        View photo = new View(context);
        photo.setBackground(round(dp(2), 0xffb9c8bb, 0xffe6d3b8, 0xff9a8279));
        FrameLayout.LayoutParams photoParams = new FrameLayout.LayoutParams(-1, -1);
        photoParams.setMargins(dp(13), dp(23), dp(13), dp(23));
        pages.addView(photo, photoParams);
        View gutter = new View(context);
        gutter.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] { 0x4d6b4d3f, 0x006b4d3f }));
        pages.addView(gutter, new FrameLayout.LayoutParams(dp(22), -1));

        View hinge = new View(context);
        hinge.setBackground(round(dp(4), 0xff33202c, 0xff7c4a5b, 0xff583044));
        FrameLayout.LayoutParams hingeParams = new FrameLayout.LayoutParams(dp(12), -1);
        hingeParams.setMargins(0, dp(2), 0, dp(2));
        albumBox.addView(hinge, hingeParams);
        for (int i = 0; i < 3; i++) {
            View band = new View(context);
            band.setBackgroundColor(0xffc9a268);
            band.setAlpha(.7f);
            FrameLayout.LayoutParams bandParams = new FrameLayout.LayoutParams(dp(6), dp(2));
            bandParams.setMargins(dp(3), dp(16 + i * 42), 0, 0);
            albumBox.addView(band, bandParams);
        }

        cover = new FrameLayout(context);
        cover.setClipChildren(false);
        albumBox.addView(cover, new FrameLayout.LayoutParams(-1, -1));
        // 相机距离要足够远，否则翻开的封面会被透视放大成一张大纸。
        cover.setCameraDistance(dp(1200));
        cover.post(() -> {
            cover.setPivotX(dp(4));
            cover.setPivotY(cover.getHeight() / 2f);
        });

        coverLining = new View(context);
        coverLining.setBackground(round(dp(6), 0xfffbf3e3, 0xffe6d7bd));
        coverLining.setAlpha(0f);
        cover.addView(coverLining, new FrameLayout.LayoutParams(-1, -1));

        FrameLayout front = new FrameLayout(context);
        front.setBackground(round(dp(6), 0xff823f52, 0xff6a3a4b, 0xff4b2b3b));
        cover.addView(front, new FrameLayout.LayoutParams(-1, -1));
        coverFront = front;
        View goldLine = new View(context);
        goldLine.setBackgroundColor(0x80d8b579);
        FrameLayout.LayoutParams goldParams = new FrameLayout.LayoutParams(dp(1), -1);
        goldParams.setMargins(dp(11), 0, 0, 0);
        front.addView(goldLine, goldParams);
        TextView coverText = text(context, "乐悠\n时光", 19, 0xfff4e3c6, true);
        coverText.setGravity(Gravity.CENTER);
        coverText.setLineSpacing(dp(2), 1f);
        FrameLayout.LayoutParams coverTextParams = new FrameLayout.LayoutParams(-1, -1);
        coverTextParams.setMargins(dp(6), 0, 0, 0);
        front.addView(coverText, coverTextParams);

        coverShade = new View(context);
        coverShade.setBackground(new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[] { 0x551d1018, 0x001d1018 }));
        coverShade.setAlpha(0f);
        cover.addView(coverShade, new FrameLayout.LayoutParams(-1, -1));

        TextView name = text(context, "乐悠时光", 23, INK, true);
        name.setLetterSpacing(.18f);
        center.addView(name);
        title = name;

        TextView subtitle = text(context, "珍藏每一个平常日子", 11, 0xff897b73, false);
        subtitle.setLetterSpacing(.1f);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(-2, -2);
        subtitleParams.topMargin = dp(8);
        center.addView(subtitle, subtitleParams);
        loadingText = subtitle;

        LinearLayout error = new LinearLayout(context);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(Gravity.CENTER_HORIZONTAL);
        center.addView(error);
        TextView message = text(context, "检查网络后，再试一次\n你的回忆还在这里等你", 13, 0xff7e7771, false);
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(-2, -2);
        messageParams.topMargin = dp(15);
        error.addView(message, messageParams);
        Button retryButton = new Button(context);
        retryButton.setText("重新连接");
        retryButton.setTextColor(Color.WHITE);
        retryButton.setTextSize(13);
        retryButton.setAllCaps(false);
        retryButton.setBackground(round(dp(24), 0xff744353));
        retryButton.setOnClickListener(v -> retry.run());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(dp(130), dp(45));
        buttonParams.topMargin = dp(24);
        error.addView(retryButton, buttonParams);
        errorText = error;

        LinearLayout footer = new LinearLayout(context);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setGravity(Gravity.CENTER_HORIZONTAL);
        LayoutParams footerParams = new LayoutParams(dp(166), -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        footerParams.bottomMargin = dp(61);
        addView(footer, footerParams);
        footer.addView(text(context, "正在打开回忆", 11, 0xff8a7270, false), new LinearLayout.LayoutParams(-2, -2));
        FrameLayout track = new FrameLayout(context);
        track.setBackgroundColor(0xffdfd7ce);
        track.setClipChildren(true);
        LinearLayout.LayoutParams trackParams = new LinearLayout.LayoutParams(-1, dp(2));
        trackParams.topMargin = dp(12);
        footer.addView(track, trackParams);
        progressBar = new View(context);
        progressBar.setBackgroundColor(0xff854e5b);
        track.addView(progressBar, new FrameLayout.LayoutParams(dp(60), -1));
        loadingFooter = footer;

        skipButton = buildSkipButton(context);
        addView(skipButton, skipParams(context));

        showLoading();
    }

    /** 右上角毛玻璃跳过按钮：网页就绪但动画还在播时出现。 */
    private TextView buildSkipButton(Context context) {
        TextView skip = new TextView(context);
        skip.setText("跳过");
        skip.setTextSize(13);
        skip.setTextColor(0xcc4a343b);
        skip.setGravity(Gravity.CENTER);
        skip.setLetterSpacing(.08f);
        GradientDrawable glass = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { 0xf2ffffff, 0xd9f1eae1 });
        glass.setCornerRadius(dp(17));
        glass.setStroke(dp(1), 0x8cffffff);
        skip.setBackground(glass);
        skip.setElevation(dp(6));
        skip.setPadding(dp(16), 0, dp(16), 0);
        skip.setContentDescription("跳过开场动画");
        skip.setAlpha(0f);
        skip.setVisibility(GONE);
        skip.setOnClickListener(v -> skipNow());
        return skip;
    }

    private LayoutParams skipParams(Context context) {
        int statusBar = 24;
        int id = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (id > 0) statusBar = Math.round(getResources().getDimension(id) / getResources().getDisplayMetrics().density);
        LayoutParams params = new LayoutParams(dp(84), dp(34), Gravity.TOP | Gravity.END);
        params.topMargin = dp(statusBar + 12);
        params.rightMargin = dp(14);
        return params;
    }

    void showLoading() {
        loadingStartedAt = SystemClock.uptimeMillis();
        pendingComplete = null;
        removeCallbacks(fadeTask);
        animate().cancel();
        setAlpha(1f);
        setVisibility(VISIBLE);
        loadingText.setVisibility(VISIBLE);
        loadingFooter.setVisibility(VISIBLE);
        errorText.setVisibility(GONE);
        skipButton.setVisibility(GONE);
        skipButton.setAlpha(0f);
        title.setText("乐悠时光");
        stopMotion();
        cover.setRotationY(0f);
        coverFront.setAlpha(1f);
        coverLining.setAlpha(0f);
        coverShade.setAlpha(0f);
        album.setTranslationX(0f);
        album.setTranslationY(0f);
        albumShadow.setScaleX(0.92f);
        albumShadow.setAlpha(0.5f);
        if (!ValueAnimator.areAnimatorsEnabled()) return;

        coverAnimator = ObjectAnimator.ofPropertyValuesHolder(cover, keyframes(View.ROTATION_Y,
                new float[] { 0f, 0f }, new float[] { 0.10f, 0f }, new float[] { 0.16f, -18f },
                new float[] { 0.30f, -84f }, new float[] { 0.42f, -140f }, new float[] { 0.50f, OPEN_ANGLE },
                new float[] { 0.80f, OPEN_ANGLE }, new float[] { 0.90f, -60f }, new float[] { 1f, 0f }));
        coverAnimator.setDuration(CYCLE);
        coverAnimator.setRepeatCount(ValueAnimator.INFINITE);
        coverAnimator.start();

        // 封面转到 90°（约 0.31 处）时换面：内侧衬页接替正面，避免出现镜像的封面。
        frontAnimator = ObjectAnimator.ofPropertyValuesHolder(coverFront, keyframes(View.ALPHA,
                new float[] { 0f, 1f }, new float[] { 0.29f, 1f }, new float[] { 0.32f, 0f },
                new float[] { 0.88f, 0f }, new float[] { 0.91f, 1f }, new float[] { 1f, 1f }));
        liningAnimator = ObjectAnimator.ofPropertyValuesHolder(coverLining, keyframes(View.ALPHA,
                new float[] { 0f, 0f }, new float[] { 0.29f, 0f }, new float[] { 0.32f, 1f },
                new float[] { 0.88f, 1f }, new float[] { 0.91f, 0f }, new float[] { 1f, 0f }));
        shadeAnimator = ObjectAnimator.ofPropertyValuesHolder(coverShade, keyframes(View.ALPHA,
                new float[] { 0f, 0f }, new float[] { 0.30f, 0.34f }, new float[] { 0.50f, 0.12f },
                new float[] { 0.80f, 0.12f }, new float[] { 0.94f, 0f }, new float[] { 1f, 0f }));
        albumAnimator = ObjectAnimator.ofPropertyValuesHolder(album,
                keyframes(View.TRANSLATION_X, new float[] { 0f, 0f }, new float[] { 0.16f, dp(4) },
                        new float[] { 0.50f, dp(OPEN_SHIFT) }, new float[] { 0.80f, dp(OPEN_SHIFT) },
                        new float[] { 1f, 0f }),
                keyframes(View.TRANSLATION_Y, new float[] { 0f, 0f }, new float[] { 0.34f, -dp(3) },
                        new float[] { 0.80f, -dp(3) }, new float[] { 1f, 0f }));
        shadowAnimator = ObjectAnimator.ofPropertyValuesHolder(albumShadow,
                keyframes(View.SCALE_X, new float[] { 0f, 0.92f }, new float[] { 0.55f, 1.16f },
                        new float[] { 0.80f, 1.16f }, new float[] { 1f, 0.92f }),
                keyframes(View.ALPHA, new float[] { 0f, 0.5f }, new float[] { 0.55f, 0.85f },
                        new float[] { 0.80f, 0.85f }, new float[] { 1f, 0.5f }));
        for (ObjectAnimator animator : new ObjectAnimator[] { coverAnimator, frontAnimator, liningAnimator, shadeAnimator, albumAnimator, shadowAnimator }) {
            animator.setDuration(CYCLE);
            animator.setRepeatCount(ValueAnimator.INFINITE);
            animator.start();
        }
        progressAnimator = ObjectAnimator.ofFloat(progressBar, View.TRANSLATION_X, -dp(60), dp(166));
        progressAnimator.setDuration(2300);
        progressAnimator.setRepeatCount(ValueAnimator.INFINITE);
        progressAnimator.start();
    }

    void showError() {
        removeCallbacks(fadeTask);
        pendingComplete = null;
        animate().cancel();
        setAlpha(1f);
        setVisibility(VISIBLE);
        stopMotion();
        cover.setRotationY(ERROR_ANGLE);
        coverFront.setAlpha(1f);
        coverLining.setAlpha(0f);
        coverShade.setAlpha(0.2f);
        album.setTranslationX(0f);
        album.setTranslationY(0f);
        albumShadow.setScaleX(1f);
        albumShadow.setAlpha(0.6f);
        loadingText.setVisibility(GONE);
        loadingFooter.setVisibility(GONE);
        errorText.setVisibility(VISIBLE);
        skipButton.setVisibility(GONE);
        title.setText("暂时没能打开");
    }

    /** 网页就绪：至少等这一轮翻开停稳，再淡出；期间显示跳过按钮。 */
    void hideAfterLoad(Runnable complete) {
        pendingComplete = complete;
        long elapsed = SystemClock.uptimeMillis() - loadingStartedAt;
        long wait = minimumShown ? 0L : Math.max(0L, MIN_VISIBLE - elapsed);
        minimumShown = true;
        if (wait > 0L) {
            skipButton.setVisibility(VISIBLE);
            skipButton.animate().alpha(1f).setDuration(200).start();
            postDelayed(fadeTask, wait);
            return;
        }
        fadeOut();
    }

    private void skipNow() {
        removeCallbacks(fadeTask);
        fadeOut();
    }

    private void fadeOut() {
        Runnable complete = pendingComplete;
        pendingComplete = null;
        if (getVisibility() != VISIBLE) {
            if (complete != null) complete.run();
            return;
        }
        stopMotion();
        skipButton.animate().alpha(0f).setDuration(120).start();
        animate().alpha(0f).setDuration(ValueAnimator.areAnimatorsEnabled() ? 300 : 0)
                .setListener(new AnimatorListenerAdapter() {
                    @Override public void onAnimationEnd(Animator animation) {
                        setVisibility(GONE);
                        animate().setListener(null);
                        skipButton.setVisibility(GONE);
                        if (complete != null) complete.run();
                    }
                }).start();
    }

    void dispose() {
        removeCallbacks(fadeTask);
        pendingComplete = null;
        animate().cancel();
        stopMotion();
    }

    private void stopMotion() {
        ObjectAnimator[] running = { coverAnimator, frontAnimator, liningAnimator, shadeAnimator, albumAnimator, shadowAnimator, progressAnimator };
        for (ObjectAnimator animator : running) if (animator != null) animator.cancel();
        coverAnimator = null;
        frontAnimator = null;
        liningAnimator = null;
        shadeAnimator = null;
        albumAnimator = null;
        shadowAnimator = null;
        progressAnimator = null;
    }

    /** 用「分数-数值」对拼出带缓动的关键帧，省掉额外插值器。 */
    private static PropertyValuesHolder keyframes(Property<View, Float> property, float[]... pairs) {
        Keyframe[] frames = new Keyframe[pairs.length];
        for (int i = 0; i < pairs.length; i++) frames[i] = Keyframe.ofFloat(pairs[i][0], pairs[i][1]);
        return PropertyValuesHolder.ofKeyframe(property, frames);
    }

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private static GradientDrawable round(float radius, int... colors) {
        GradientDrawable drawable = colors.length > 1
                ? new GradientDrawable(GradientDrawable.Orientation.TL_BR, colors)
                : new GradientDrawable();
        if (colors.length == 1) drawable.setColor(colors[0]);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private static TextView text(Context context, String value, int size, int color, boolean serif) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (serif) view.setTypeface(Typeface.SERIF, Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        return view;
    }
}
