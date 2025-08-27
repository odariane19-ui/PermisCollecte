export interface CameraConstraints {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
}

class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async requestPermission(): Promise<boolean> {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state === 'granted';
    } catch (error) {
      // Fallback: try to access camera directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    }
  }

  async startCamera(
    videoElement: HTMLVideoElement,
    constraints: CameraConstraints = {}
  ): Promise<MediaStream> {
    const defaultConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user',
      ...constraints
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: defaultConstraints,
        audio: false
      });

      this.video = videoElement;
      videoElement.srcObject = this.stream;
      
      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play()
            .then(() => resolve(this.stream!))
            .catch(reject);
        };
        videoElement.onerror = reject;
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw new Error('Unable to access camera. Please check permissions.');
    }
  }

  async capturePhoto(videoElement: HTMLVideoElement): Promise<string> {
    if (!videoElement || videoElement.videoWidth === 0) {
      throw new Error('Video not ready for capture');
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Unable to create canvas context');
    }

    // Set canvas size to video dimensions
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    // Draw video frame to canvas
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Convert to base64 JPEG
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
  }

  async switchCamera(): Promise<MediaStream | null> {
    if (!this.video) return null;

    const currentConstraints = this.stream?.getVideoTracks()[0]?.getSettings();
    const newFacingMode = currentConstraints?.facingMode === 'user' ? 'environment' : 'user';

    this.stopCamera();
    
    try {
      return await this.startCamera(this.video, { facingMode: newFacingMode });
    } catch (error) {
      console.error('Error switching camera:', error);
      return null;
    }
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}

export const cameraManager = new CameraManager();
