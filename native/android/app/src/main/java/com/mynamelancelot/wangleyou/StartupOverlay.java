package com.mynamelancelot.wangleyou;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.SurfaceTexture;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaPlayer;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.Surface;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.view.TextureView;

/** 本地视频开屏：同一纹理层呈现完整视频，失败时回退到奶油白背景。 */
final class StartupOverlay extends FrameLayout {
    private static final int PAPER = 0xfff7f5f0;
    private static final long MAX_WAIT_FOR_VIDEO = 10000L;

    private final TextureView video;
    private final View loadingFooter;
    private final View progressSegment;
    private final View errorPanel;
    private final TextView skipButton;
    private final Runnable fadeTask = this::fadeOut;
    private long loadingStartedAt;
    private boolean loading;
    private boolean foreground = true;
    private boolean prepared;
    private boolean videoFinished;
    private int playbackPosition;
    private int videoWidth = 1080;
    private int videoHeight = 1920;
    private MediaPlayer player;
    private ObjectAnimator progressAnimator;
    private Runnable pendingComplete;

    StartupOverlay(Context context, Runnable retry) {
        super(context);
        setBackgroundColor(PAPER);
        setClickable(true);

        video = new TextureView(context);
        video.setOpaque(false);
        video.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
            @Override public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
                updateVideoTransform();
                if (loading && !videoFinished) startVideo();
            }
            @Override public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
                updateVideoTransform();
            }
            @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
                savePlaybackPosition();
                releasePlayer();
                if (loading && videoFinished) video.setVisibility(GONE);
                return true;
            }
            @Override public void onSurfaceTextureUpdated(SurfaceTexture surface) { }
        });
        addView(video, new LayoutParams(-1, -1));
        LinearLayout footer = new LinearLayout(context);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setGravity(Gravity.CENTER_HORIZONTAL);
        LayoutParams footerParams = new LayoutParams(dp(166), -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        footerParams.bottomMargin = dp(61);
        addView(footer, footerParams);
        footer.addView(text(context, "正在打开回忆", 11, 0xff8a7270, false));
        FrameLayout track = new FrameLayout(context);
        track.setBackgroundColor(0xffdfd7ce);
        track.setClipChildren(true);
        LinearLayout.LayoutParams trackParams = new LinearLayout.LayoutParams(dp(166), dp(2));
        trackParams.topMargin = dp(12);
        footer.addView(track, trackParams);
        View segment = new View(context);
        segment.setBackgroundColor(0xff854e5b);
        track.addView(segment, new LayoutParams(dp(48), -1));
        progressSegment = segment;
        loadingFooter = footer;

        LinearLayout error = new LinearLayout(context);
        error.setOrientation(LinearLayout.VERTICAL);
        error.setGravity(Gravity.CENTER_HORIZONTAL);
        error.setBackground(round(dp(18), 0xfaf7f5f0));
        error.setPadding(dp(12), dp(16), dp(12), dp(16));
        error.setElevation(dp(4));
        LayoutParams errorParams = new LayoutParams(-1, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        errorParams.leftMargin = dp(20);
        errorParams.rightMargin = dp(20);
        errorParams.bottomMargin = dp(32);
        addView(error, errorParams);
        TextView errorTitle = text(context, "暂时没能打开", 21, 0xff5b3943, true);
        error.addView(errorTitle);
        TextView message = text(context, "检查网络后，再试一次\n你的回忆还在这里等你", 13, 0xff7e7771, false);
        message.setGravity(Gravity.CENTER);
        message.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(-2, -2);
        messageParams.topMargin = dp(12);
        error.addView(message, messageParams);
        Button retryButton = new Button(context);
        retryButton.setText("重新连接");
        retryButton.setTextColor(Color.WHITE);
        retryButton.setTextSize(13);
        retryButton.setAllCaps(false);
        retryButton.setBackground(round(dp(24), 0xff744353));
        retryButton.setOnClickListener(v -> retry.run());
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(dp(130), dp(45));
        buttonParams.topMargin = dp(20);
        error.addView(retryButton, buttonParams);
        errorPanel = error;

        skipButton = buildSkipButton(context);
        addView(skipButton, skipParams());
        showLoading();
    }

    private TextView buildSkipButton(Context context) {
        TextView skip = text(context, "跳过", 13, 0xcc4a343b, false);
        skip.setLetterSpacing(.08f);
        GradientDrawable glass = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                new int[] { 0xf2ffffff, 0xd9f1eae1 });
        glass.setCornerRadius(dp(17));
        glass.setStroke(dp(1), 0x8cffffff);
        skip.setBackground(glass);
        skip.setElevation(dp(6));
        skip.setContentDescription("跳过开场动画");
        skip.setOnClickListener(v -> fadeOut());
        return skip;
    }

    private LayoutParams skipParams() {
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
        loading = true;
        releasePlayer();
        prepared = false;
        videoFinished = !ValueAnimator.areAnimatorsEnabled();
        playbackPosition = 0;
        pendingComplete = null;
        removeCallbacks(fadeTask);
        animate().cancel();
        setAlpha(1f);
        setVisibility(VISIBLE);
        loadingFooter.setVisibility(VISIBLE);
        startProgressMotion();
        errorPanel.setVisibility(GONE);
        skipButton.setVisibility(GONE);
        if (videoFinished) {
            video.setVisibility(GONE);
        } else {
            video.setAlpha(0f);
            video.setVisibility(VISIBLE);
            video.post(this::updateVideoTransform);
            if (video.isAvailable()) startVideo();
        }
    }

    void showError() {
        loading = false;
        pendingComplete = null;
        removeCallbacks(fadeTask);
        animate().cancel();
        releasePlayer();
        video.setVisibility(GONE);
        setAlpha(1f);
        setVisibility(VISIBLE);
        loadingFooter.setVisibility(GONE);
        stopProgressMotion();
        errorPanel.setVisibility(VISIBLE);
        skipButton.setVisibility(GONE);
    }

    /** 网页就绪后等视频播完；解码未结束时仍可跳过，超时则自动放行。 */
    void hideAfterLoad(Runnable complete) {
        if (!loading) return;
        pendingComplete = complete;
        if (videoFinished) {
            if (foreground) fadeOut();
            return;
        }
        skipButton.setVisibility(VISIBLE);
        if (foreground) {
            long elapsed = SystemClock.uptimeMillis() - loadingStartedAt;
            postDelayed(fadeTask, Math.max(0L, MAX_WAIT_FOR_VIDEO - elapsed));
        }
    }

    void pausePlayback() {
        foreground = false;
        stopProgressMotion();
        removeCallbacks(fadeTask);
        if (loading && prepared && player != null && player.isPlaying()) {
            savePlaybackPosition();
            player.pause();
        }
    }

    void resumePlayback() {
        foreground = true;
        if (loading) startProgressMotion();
        if (pendingComplete != null && videoFinished) { fadeOut(); return; }
        if (pendingComplete != null) postDelayed(fadeTask, MAX_WAIT_FOR_VIDEO);
        if (loading && prepared && player != null && !videoFinished && getVisibility() == VISIBLE) player.start();
    }

    private void startVideo() {
        if (player != null || !video.isAvailable() || !loading || videoFinished) return;
        try {
            MediaPlayer next = new MediaPlayer();
            player = next;
            try (AssetFileDescriptor source = getResources().openRawResourceFd(R.raw.album_opening)) {
                next.setDataSource(source.getFileDescriptor(), source.getStartOffset(), source.getLength());
            }
            Surface surface = new Surface(video.getSurfaceTexture());
            next.setSurface(surface);
            surface.release();
            next.setOnPreparedListener(ready -> {
                if (ready != player || !loading) return;
                prepared = true;
                videoWidth = ready.getVideoWidth();
                videoHeight = ready.getVideoHeight();
                updateVideoTransform();
                if (playbackPosition > 0) ready.seekTo(playbackPosition);
                if (foreground) ready.start();
            });
            next.setOnInfoListener((source, what, extra) -> {
                if (source == player && what == MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START) {
                    updateVideoTransform();
                    video.setAlpha(1f);
                }
                return false;
            });
            next.setOnCompletionListener(source -> {
                if (source != player || !loading) return;
                videoFinished = true;
                if (pendingComplete != null && foreground) fadeOut();
            });
            next.setOnErrorListener((source, what, extra) -> {
                if (source == player && loading) handleVideoFailure();
                return true;
            });
            next.prepareAsync();
        } catch (Exception ignored) {
            handleVideoFailure();
        }
    }

    private void updateVideoTransform() {
        int width = video.getWidth();
        int height = video.getHeight();
        if (width == 0 || height == 0 || videoWidth == 0 || videoHeight == 0) return;
        float scale = Math.max((float) width / videoWidth, (float) height / videoHeight);
        Matrix transform = new Matrix();
        transform.setScale(videoWidth * scale / width, videoHeight * scale / height,
                width / 2f, height / 2f);
        video.setTransform(transform);
    }

    private void handleVideoFailure() {
        releasePlayer();
        videoFinished = true;
        video.setVisibility(GONE);
        if (pendingComplete != null && foreground) fadeOut();
    }

    private void savePlaybackPosition() {
        if (player != null && prepared && !videoFinished) {
            try { playbackPosition = player.getCurrentPosition(); }
            catch (IllegalStateException ignored) { }
        }
    }

    private void releasePlayer() {
        MediaPlayer current = player;
        player = null;
        prepared = false;
        if (current != null) {
            current.setOnErrorListener(null);
            current.setOnCompletionListener(null);
            current.release();
        }
    }

    private void fadeOut() {
        removeCallbacks(fadeTask);
        Runnable complete = pendingComplete;
        pendingComplete = null;
        if (complete == null || getVisibility() != VISIBLE) return;
        loading = false;
        stopProgressMotion();
        skipButton.setVisibility(GONE);
        animate().alpha(0f).setDuration(ValueAnimator.areAnimatorsEnabled() ? 300 : 0)
                .setListener(new AnimatorListenerAdapter() {
                    @Override public void onAnimationEnd(Animator animation) {
                        releasePlayer();
                        setVisibility(GONE);
                        animate().setListener(null);
                        complete.run();
                    }
                }).start();
    }

    void dispose() {
        removeCallbacks(fadeTask);
        pendingComplete = null;
        loading = false;
        stopProgressMotion();
        animate().cancel();
        releasePlayer();
    }

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private void startProgressMotion() {
        stopProgressMotion();
        progressSegment.setTranslationX(dp(59));
        if (!foreground || !ValueAnimator.areAnimatorsEnabled()) return;
        progressAnimator = ObjectAnimator.ofFloat(progressSegment, View.TRANSLATION_X, 0f, dp(118));
        progressAnimator.setDuration(1400L);
        progressAnimator.setRepeatCount(ValueAnimator.INFINITE);
        progressAnimator.setRepeatMode(ValueAnimator.REVERSE);
        progressAnimator.setInterpolator(new LinearInterpolator());
        progressAnimator.start();
    }

    private void stopProgressMotion() {
        if (progressAnimator != null) {
            progressAnimator.cancel();
            progressAnimator = null;
        }
    }

    private static GradientDrawable round(float radius, int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private static TextView text(Context context, String value, int size, int color, boolean serif) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (serif) view.setTypeface(android.graphics.Typeface.SERIF, android.graphics.Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        return view;
    }
}
