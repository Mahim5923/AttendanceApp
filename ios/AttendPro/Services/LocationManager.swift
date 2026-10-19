import Foundation
import CoreLocation
import Combine

public class LocationManager: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    
    @Published public var currentLocation: CLLocation?
    @Published public var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published public var isWithinGeofence: Bool = false
    @Published public var distanceToOfficeMeters: Double = 0.0

    public override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = 5.0
    }

    public func requestPermission() {
        manager.requestWhenInUseAuthorization()
    }

    public func startUpdating() {
        manager.startUpdatingLocation()
    }

    public func stopUpdating() {
        manager.stopUpdatingLocation()
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        self.authorizationStatus = manager.authorizationStatus
        if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
            manager.startUpdatingLocation()
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last else { return }
        self.currentLocation = loc
    }

    public func checkGeofence(targetLat: Double, targetLon: Double, radiusMeters: Double) -> (isInside: Bool, distance: Double) {
        guard let current = currentLocation else { return (false, 0) }
        if targetLat == 0.0 && targetLon == 0.0 {
            return (true, 0.0) // No geofence defined
        }
        let target = CLLocation(latitude: targetLat, longitude: targetLon)
        let distance = current.distance(from: target)
        let isInside = distance <= radiusMeters
        DispatchQueue.main.async {
            self.distanceToOfficeMeters = distance
            self.isWithinGeofence = isInside
        }
        return (isInside, distance)
    }
}
