(function () {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  const latInput = document.getElementById("lat");
  const lngInput = document.getElementById("lng");

  const map = L.map("map").setView([23.8103, 90.4125], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "© OpenStreetMap",
  }).addTo(map);

  let marker = null;
  function setMarker(lat, lng) {
    if (marker) marker.remove();
    marker = L.marker([lat, lng]).addTo(map);
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
  }

  map.on("click", function (e) {
    setMarker(e.latlng.lat, e.latlng.lng);
  });

  const useBtn = document.getElementById("use-location");
  if (useBtn) {
    useBtn.addEventListener("click", function () {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 13);
        setMarker(lat, lng);
      });
    });
  }
})();
