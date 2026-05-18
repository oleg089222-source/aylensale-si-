import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirebaseStorage } from "./firebase";

export async function uploadProductPhotos(productId: string, files: File[]): Promise<string[]> {
  const storage = getFirebaseStorage();
  const urls: string[] = [];

  for (let i = 0; i < Math.min(files.length, 10); i++) {
    const file = files[i];
    const path = `products/${productId}/${Date.now()}-${i}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const imageRef = ref(storage, path);
    await uploadBytes(imageRef, file);
    urls.push(await getDownloadURL(imageRef));
  }

  return urls;
}

export async function uploadLocationPhoto(locationId: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  const path = `car-boot/${locationId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
}

export async function deleteStorageUrl(url: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const path = decodeURIComponent(url.split("/o/")[1]?.split("?")[0] ?? "");
    if (!path) return;
    await deleteObject(ref(storage, path));
  } catch {
    // ignore missing objects
  }
}
