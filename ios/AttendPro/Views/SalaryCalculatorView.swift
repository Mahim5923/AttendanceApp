import SwiftUI

public struct SalaryCalculatorView: View {
    @ObservedObject var firebase = FirebaseService.shared
    @Environment(\.presentationMode) var presentationMode

    private var primaryRed: Color {
        Color(red: 229/255, green: 57/255, blue: 53/255)
    }

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    Text("Salary Calculator Dashboard")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.black)
                        .padding(.top, 12)

                    let email = firebase.currentUserEmail ?? ""
                    let result = firebase.calculateSalaryForEmployee(employeeId: email)

                    // Card 1: Attendance Breakdown (matches Android CalculatorScreen)
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Base Salary: ₹\(Int(result.baseSalary))")
                            .font(.system(size: 18, weight: .bold))
                            .foregroundColor(.black)

                        Divider()

                        HStack {
                            Text("Total Working Days (Month):")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(result.totalWorkingDays)")
                                .fontWeight(.semibold)
                        }

                        HStack {
                            Text("Days Present:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(result.presentDays)")
                                .foregroundColor(Color(red: 46/255, green: 125/255, blue: 50/255))
                                .fontWeight(.semibold)
                        }

                        HStack {
                            Text("Approved Leaves:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(result.approvedLeaveDays)")
                                .foregroundColor(primaryRed)
                                .fontWeight(.semibold)
                        }

                        HStack {
                            Text("Days Absent:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("\(result.absentDays)")
                                .foregroundColor(.red)
                                .fontWeight(.semibold)
                        }
                    }
                    .padding(20)
                    .background(Color.white)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                    )

                    // Card 2: Calculation Breakdown (matches Android CalculatorScreen)
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Per Day Salary:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("₹\(Int(result.perDaySalary))")
                                .fontWeight(.semibold)
                        }

                        HStack {
                            Text("Total Deduction:")
                                .foregroundColor(.gray)
                            Spacer()
                            Text("₹\(Int(result.deduction))")
                                .foregroundColor(.red)
                                .fontWeight(.semibold)
                        }

                        Divider()

                        HStack {
                            Text("Estimated Net Salary:")
                                .font(.system(size: 17, weight: .bold))
                            Spacer()
                            Text("₹\(Int(result.netSalary))")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(Color(red: 46/255, green: 125/255, blue: 50/255))
                        }
                    }
                    .padding(20)
                    .background(Color.white)
                    .cornerRadius(16)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                    )

                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Salary Calculator")
            .navigationBarItems(trailing: Button("Done") { presentationMode.wrappedValue.dismiss() })
        }
    }
}
